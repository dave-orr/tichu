import { firebaseAdmin } from './firebase.js';
import { getRoom, type Room } from './rooms.js';

/**
 * Live-game durability: snapshot active rooms to Firestore so games survive a
 * server restart (the room map is otherwise in-memory only). Snapshots are
 * written debounced on every state broadcast, reloaded on startup, and deleted
 * when a room is torn down. An `expireAt` field is stamped as a TTL backstop so
 * crashed/abandoned snapshots that never get an explicit delete eventually
 * disappear on their own.
 *
 * Firestore can't store JS Maps/Sets or nested arrays directly, so the whole
 * Room is serialized to a single JSON string field.
 */

const COLLECTION = 'liveRooms';
// TTL backstop — a snapshot is considered stale this long after its last write.
// Refreshed on every save, so an active game never expires out from under us.
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Debounce window to coalesce the burst of writes during active play.
const PERSIST_DEBOUNCE_MS = 1500;

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Snapshot writes currently in flight, so a delete can be sequenced after
// them instead of racing (a `set` landing after the `delete` would leave a
// zombie snapshot that gets resurrected on the next restart).
const inFlightWrites = new Map<string, Promise<void>>();
// When each room's snapshot last landed in Firestore (ms), for the dashboard.
const lastSavedAt = new Map<string, number>();

function mapSetReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return { __t: 'Map', v: Array.from(value.entries()) };
  if (value instanceof Set) return { __t: 'Set', v: Array.from(value.values()) };
  return value;
}

function mapSetReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '__t' in value) {
    const tagged = value as { __t: string; v: unknown };
    if (tagged.__t === 'Map') return new Map(tagged.v as [unknown, unknown][]);
    if (tagged.__t === 'Set') return new Set(tagged.v as unknown[]);
  }
  return value;
}

/** Schedule a debounced snapshot write for a room. No-op without Firebase. */
export function persistRoom(room: Room): void {
  if (!firebaseAdmin) return;
  const code = room.code;
  // Waiting rooms aren't worth restoring: they hold no game, and after a
  // restart their seats would be reserved by socket ids that no longer exist.
  // A room can return to waiting via "play again", so drop any snapshot of
  // the finished game rather than let it resurrect on the next restart.
  if (room.state.phase === 'waiting') {
    deletePersistedRoom(code);
    return;
  }
  const existing = debounceTimers.get(code);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    debounceTimers.delete(code);
    startWrite(room);
  }, PERSIST_DEBOUNCE_MS);
  debounceTimers.set(code, timer);
}

function startWrite(room: Room): void {
  const code = room.code;
  // The room may have been torn down (or its code reused, or reset to
  // waiting) while debouncing.
  if (getRoom(code) !== room || room.state.phase === 'waiting') return;
  const startedAt = Date.now();
  const write = writeSnapshot(room)
    .then(() => { lastSavedAt.set(code, startedAt); })
    .catch(err => console.error(`[persist] failed to write room ${code}:`, err))
    .finally(() => {
      if (inFlightWrites.get(code) === write) inFlightWrites.delete(code);
    });
  inFlightWrites.set(code, write);
}

/** Whether snapshots are being written at all (Firebase configured). */
export function persistenceEnabled(): boolean {
  return !!firebaseAdmin;
}

/** Snapshot status of one room, for the admin dashboard. */
export function getPersistStatus(code: string): { savedAt: number | null; pending: boolean } {
  return {
    savedAt: lastSavedAt.get(code) ?? null,
    pending: debounceTimers.has(code) || inFlightWrites.has(code),
  };
}

/**
 * Write every debounced snapshot now and wait for all in-flight writes, so a
 * shutdown doesn't drop the last moves before a restart. Bounded by
 * `timeoutMs` so a hung Firestore can't block exit forever.
 */
export async function flushPersistence(timeoutMs: number): Promise<number> {
  const pendingCodes = Array.from(debounceTimers.keys());
  for (const code of pendingCodes) {
    clearTimeout(debounceTimers.get(code)!);
    debounceTimers.delete(code);
    const room = getRoom(code);
    if (room) startWrite(room);
  }
  const writes = Array.from(inFlightWrites.values());
  if (writes.length === 0) return 0;
  let timedOut = false;
  await Promise.race([
    Promise.allSettled(writes),
    new Promise<void>(resolve => setTimeout(() => { timedOut = true; resolve(); }, timeoutMs).unref()),
  ]);
  if (timedOut) console.error(`[persist] shutdown flush timed out after ${timeoutMs}ms`);
  return writes.length;
}

async function writeSnapshot(room: Room): Promise<void> {
  if (!firebaseAdmin) return;
  const db = firebaseAdmin.firestore();
  const data = JSON.stringify(room, mapSetReplacer);
  await db.collection(COLLECTION).doc(room.code).set({
    code: room.code,
    phase: room.state.phase,
    data,
    updatedAt: Date.now(),
    expireAt: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + SNAPSHOT_TTL_MS),
  });
}

/** Delete a room's snapshot (called when the room is torn down). */
export function deletePersistedRoom(code: string): void {
  lastSavedAt.delete(code);
  const timer = debounceTimers.get(code);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(code);
  }
  if (!firebaseAdmin) return;
  const db = firebaseAdmin.firestore();
  const pending = inFlightWrites.get(code) ?? Promise.resolve();
  pending.then(() => db.collection(COLLECTION).doc(code).delete()).catch(err =>
    console.error(`[persist] failed to delete room ${code}:`, err)
  );
}

/** Load all (non-expired) room snapshots from Firestore on startup. */
export async function loadPersistedRooms(): Promise<Room[]> {
  if (!firebaseAdmin) return [];
  const db = firebaseAdmin.firestore();
  const snap = await db.collection(COLLECTION).get();
  const now = Date.now();
  const rooms: Room[] = [];
  for (const doc of snap.docs) {
    const d = doc.data() as { data?: string; updatedAt?: number; expireAt?: FirebaseFirestore.Timestamp };
    // TTL deletion can lag — skip (and clean up) anything already expired.
    if (d.expireAt && d.expireAt.toMillis() < now) {
      doc.ref.delete().catch(() => { /* best-effort */ });
      continue;
    }
    if (!d.data) continue;
    try {
      rooms.push(JSON.parse(d.data, mapSetReviver) as Room);
      if (d.updatedAt) lastSavedAt.set(doc.id, d.updatedAt);
    } catch (err) {
      console.error(`[persist] failed to parse snapshot ${doc.id}:`, err);
    }
  }
  return rooms;
}
