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
    // The room may have been torn down (or its code reused, or reset to
    // waiting) while debouncing.
    if (getRoom(code) !== room || room.state.phase === 'waiting') return;
    const write = writeSnapshot(room)
      .catch(err => console.error(`[persist] failed to write room ${code}:`, err))
      .finally(() => {
        if (inFlightWrites.get(code) === write) inFlightWrites.delete(code);
      });
    inFlightWrites.set(code, write);
  }, PERSIST_DEBOUNCE_MS);
  debounceTimers.set(code, timer);
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
    const d = doc.data() as { data?: string; expireAt?: FirebaseFirestore.Timestamp };
    // TTL deletion can lag — skip (and clean up) anything already expired.
    if (d.expireAt && d.expireAt.toMillis() < now) {
      doc.ref.delete().catch(() => { /* best-effort */ });
      continue;
    }
    if (!d.data) continue;
    try {
      rooms.push(JSON.parse(d.data, mapSetReviver) as Room);
    } catch (err) {
      console.error(`[persist] failed to parse snapshot ${doc.id}:`, err);
    }
  }
  return rooms;
}
