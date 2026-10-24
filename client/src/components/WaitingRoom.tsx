import { useState, useEffect, useRef } from 'react';
import type { Seat, ClientGameState, GameSettings, InvitablePlayer, RoomElos } from '@tichu/shared';
import InvitePanel from './InvitePanel.js';
import HouseRules, { SectionLabel } from './HouseRules.js';
import ThemeGallery from './ThemeGallery.js';

const SEAT_NAMES = ['North', 'East', 'South', 'West'];
// Each seat's cell in the 3x3 table diagram (the table top is the centre).
const SEAT_POSITION = [
  'col-start-2 row-start-1',
  'col-start-3 row-start-2',
  'col-start-2 row-start-3',
  'col-start-1 row-start-2',
];
const UNRATED_TITLE = 'Games with a bot are unrated — no Elo is won or lost.';

type Props = {
  roomCode: string;
  gameState: ClientGameState;
  isOrganizer: boolean;
  randomPartners: boolean;
  hasProfile: boolean;
  aiOpenSeats: number[];
  disconnectedSeats: number[];
  onSwapSeats: (from: Seat, to: Seat) => void;
  onShuffleSeats: () => void;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  onUpdateRandomPartners: (randomPartners: boolean) => void;
  onStartGame: () => void;
  onCancelRoom: () => void;
  onLeaveRoom: () => void;
  onMarkSeatAi: (seat: Seat) => void;
  onUnmarkSeatAi: (seat: Seat) => void;
  fetchPlayers: () => Promise<{ players: InvitablePlayer[] }>;
  fetchRoomElos: () => Promise<RoomElos>;
  sendInvite: (targetUid: string) => void;
  expiredInviteUids: Set<string>;
};

function Icon({ children, className = 'w-5 h-5' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function WaitingRoom({
  roomCode, gameState, isOrganizer, randomPartners, hasProfile,
  aiOpenSeats, disconnectedSeats, onSwapSeats, onShuffleSeats, onUpdateSettings, onUpdateRandomPartners, onStartGame,
  onCancelRoom, onLeaveRoom, onUnmarkSeatAi,
  fetchPlayers, fetchRoomElos, sendInvite, expiredInviteUids,
}: Props) {
  // A seat picked up for rearranging, by click (then click the destination)
  // or by drag.
  const [swapFrom, setSwapFrom] = useState<Seat | null>(null);
  const [dragOver, setDragOver] = useState<Seat | null>(null);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [roomElos, setRoomElos] = useState<RoomElos | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [invitedPlayers, setInvitedPlayers] = useState<InvitablePlayer[]>([]);

  const handleInvited = (player: InvitablePlayer) => {
    setInvitedPlayers(prev => prev.some(p => p.uid === player.uid) ? prev : [...prev, player]);
  };

  // Show only invitees who haven't joined yet. Seated players don't expose their
  // uid, so match on photo/name (both come from the same Google profile). Also
  // drop any the server has told us expired.
  const seatedPhotos = new Set(gameState.players.filter(p => p.name && p.photoURL).map(p => p.photoURL));
  const seatedNames = new Set(gameState.players.filter(p => p.name).map(p => p.name.toLowerCase()));
  const pendingInvited = invitedPlayers.filter(p =>
    !expiredInviteUids.has(p.uid) &&
    !(p.photoURL && seatedPhotos.has(p.photoURL)) &&
    !seatedNames.has(p.displayName.toLowerCase())
  );

  // Track the copied-indicator timer so it can't setState after unmount
  // (the waiting room unmounts the moment the game starts).
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* clipboard unavailable — ignore */ });
  };

  const playerCount = gameState.players.filter(p => p.name).length;
  const missing = 4 - playerCount;
  // Seats can be rearranged by the organizer unless teams are drawn at random
  // anyway. The server refuses moves involving a disconnected player (their
  // reconnect timer is keyed by seat), so the UI doesn't offer them.
  const canRearrange = isOrganizer && !randomPartners;
  const isMovable = (seat: number) => canRearrange && !!gameState.players[seat].name && !disconnectedSeats.includes(seat);
  const isDropTarget = (seat: number) =>
    swapFrom !== null && seat !== swapFrom && !disconnectedSeats.includes(seat) &&
    (!!gameState.players[seat].name || !aiOpenSeats.includes(seat));
  // Games with any AI player are unrated — nobody gains or loses Elo.
  const hasAi = gameState.players.some(p => p.isAi) || aiOpenSeats.length > 0;

  // Refetch Elo ratings whenever the seated players change (joins, swaps, etc.).
  const seatSignature = gameState.players.map(p => p.id || '').join('|');
  useEffect(() => {
    let cancelled = false;
    fetchRoomElos().then(elos => { if (!cancelled) setRoomElos(elos); });
    return () => { cancelled = true; };
  }, [fetchRoomElos, seatSignature]);

  // A pick-up that's no longer valid (the player left, the room changed) is dropped.
  useEffect(() => {
    if (swapFrom !== null && !isMovable(swapFrom)) setSwapFrom(null);
  });

  const moveTo = (seat: Seat) => {
    if (swapFrom !== null && isDropTarget(seat)) onSwapSeats(swapFrom, seat);
    setSwapFrom(null);
    setDragOver(null);
  };

  const handleSeatClick = (seat: Seat) => {
    if (swapFrom === null) {
      if (isMovable(seat)) setSwapFrom(seat);
    } else if (swapFrom === seat) {
      setSwapFrom(null);
    } else {
      moveTo(seat);
    }
  };

  // One seat around the table: avatar ringed in the team colour (N+S sky,
  // E+W amber, matching the centre of the table), name and Elo.
  const renderSeat = (i: number) => {
    const p = gameState.players[i];
    const seat = i as Seat;
    const isMe = gameState.mySeat === i;
    const isAiOpen = aiOpenSeats.includes(i);
    const isDisconnected = disconnectedSeats.includes(i);
    const movable = isMovable(i);
    const picked = swapFrom === i;
    const target = isDropTarget(i);
    const team = i % 2 === 0
      ? { text: 'text-sky-300', ring: 'ring-sky-400' }
      : { text: 'text-amber-300', ring: 'ring-amber-400' };
    return (
      <div
        key={i}
        className={`${SEAT_POSITION[i]} w-32 sm:w-44 flex flex-col items-center text-center rounded-2xl px-2 py-2 transition-all duration-150 select-none ${
          movable || target ? 'cursor-pointer' : ''
        } ${picked ? 'bg-ochre/20 ring-2 ring-ochre' : target ? (dragOver === i ? 'bg-ochre/25 ring-2 ring-ochre' : 'outline-dashed outline-2 outline-ochre/50 hover:bg-ochre/15') : movable ? 'hover:bg-white/5' : ''}`}
        onClick={() => handleSeatClick(seat)}
        draggable={movable}
        onDragStart={e => {
          e.dataTransfer.setData('text/plain', String(i));
          e.dataTransfer.effectAllowed = 'move';
          setSwapFrom(seat);
        }}
        onDragEnd={() => { setSwapFrom(null); setDragOver(null); }}
        onDragOver={e => {
          if (!target) return;
          e.preventDefault();
          if (dragOver !== i) setDragOver(seat);
        }}
        onDragLeave={() => { if (dragOver === i) setDragOver(null); }}
        onDrop={e => { e.preventDefault(); moveTo(seat); }}
      >
        <span className={`text-xs font-bold uppercase tracking-[0.18em] mb-1.5 ${team.text}`}>{SEAT_NAMES[i]}</span>
        {p.name ? (
          <div className="relative">
            {p.photoURL ? (
              <img src={p.photoURL} alt="" draggable={false} referrerPolicy="no-referrer" className={`w-14 h-14 rounded-full object-cover ring-4 ${team.ring} ${isDisconnected ? 'grayscale opacity-60' : ''}`} />
            ) : (
              <span className={`w-14 h-14 rounded-full bg-black/30 ring-4 ${team.ring} flex items-center justify-center font-display text-3xl text-cream ${isDisconnected ? 'opacity-60' : ''}`}>
                {p.name[0]?.toUpperCase()}
              </span>
            )}
            {isMe && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 rounded-full bg-ochre text-ink text-[11px] font-extrabold uppercase tracking-wider leading-4 shadow">You</span>
            )}
          </div>
        ) : (
          <span className={`w-14 h-14 rounded-full border-2 border-dashed ${target ? 'border-ochre' : 'border-cream/30'} flex items-center justify-center text-cream/40`}>
            <Icon className="w-7 h-7"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>
          </span>
        )}
        {p.name ? (
          <>
            <span className="mt-2 max-w-full truncate font-display text-xl leading-tight text-cream">
              {p.name}
              {p.isAi && <span className="ml-1 text-sm font-sans text-cream/60">(Bot)</span>}
            </span>
            {isDisconnected ? (
              <span className="text-sm text-amber-300 italic">reconnecting…</span>
            ) : roomElos?.seatElos[i] != null ? (
              <span className="text-sm text-ochre-light/90 font-semibold tabular-nums">{roomElos.seatElos[i]} Elo</span>
            ) : null}
          </>
        ) : (
          <>
            <span className="mt-2 text-base italic text-cream/55">{isAiOpen ? 'Bot joining…' : 'Open seat'}</span>
            {isOrganizer && (isAiOpen ? (
              <button
                onClick={e => { e.stopPropagation(); onUnmarkSeatAi(seat); }}
                className="btn btn-quiet mt-1 px-2.5 py-0.5 text-xs"
              >
                Cancel bot
              </button>
            ) : (
              // Bots don't play yet, so this is shown but not offered.
              <button disabled title="Bots aren't available yet" className="btn btn-quiet mt-1 px-2.5 py-0.5 text-xs">
                Add bot
              </button>
            ))}
          </>
        )}
      </div>
    );
  };

  const tableHint = !isOrganizer
    ? null
    : randomPartners
      ? 'Seats are drawn at random when the game starts'
      : swapFrom !== null
        ? `Now pick a seat for ${gameState.players[swapFrom].name}`
        : playerCount > 0 ? 'Drag a player (or click two seats) to move them' : null;

  return (
    <div className="table-felt min-h-screen flex flex-col items-center justify-center px-6 py-4">
      <div className="w-full max-w-6xl">
        {/* Header: leave / cancel, title, invite + room code */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-4">
          <div>
            <button
              onClick={isOrganizer ? () => setShowCancelConfirm(true) : onLeaveRoom}
              className="btn btn-quiet flex items-center gap-2 pl-3 pr-4 py-2 text-base"
            >
              <Icon><polyline points="15 18 9 12 15 6" /></Icon>
              {isOrganizer ? 'Cancel room' : 'Leave room'}
            </button>
          </div>
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl text-cream leading-tight">Tichu</h1>
            <p className="text-cream/60 mt-1">
              {missing > 0 ? `Waiting for ${missing} more player${missing === 1 ? '' : 's'}` : 'Everyone’s here'}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            {isOrganizer && missing > 0 && hasProfile && (
              <button onClick={() => setShowInvitePanel(true)} aria-label="Invite players" className="btn btn-quiet flex items-center gap-2 px-3 sm:px-4 py-2 text-base">
                <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></Icon>
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}
            <button
              onClick={handleCopyCode}
              title="Copy room code"
              className="group surface flex items-center gap-3 pl-4 pr-3 py-1.5 hover:ring-ochre/60 transition-shadow"
            >
              <span className="text-left leading-none">
                <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-cream/55">{copied ? 'Copied!' : 'Room code'}</span>
                <span className="block font-mono text-3xl font-bold tracking-[0.2em] text-ochre-light mt-1">{roomCode}</span>
              </span>
              <span className={`transition-colors ${copied ? 'text-good' : 'text-cream/50 group-hover:text-cream'}`}>
                {copied
                  ? <Icon className="w-6 h-6"><polyline points="20 6 9 17 4 12" /></Icon>
                  : <Icon className="w-6 h-6"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>}
              </span>
            </button>
          </div>
        </div>

        {showInvitePanel && (
          <InvitePanel
            onClose={() => setShowInvitePanel(false)}
            fetchPlayers={fetchPlayers}
            sendInvite={sendInvite}
            expiredInviteUids={expiredInviteUids}
            onInvite={handleInvited}
            invitedUids={new Set(invitedPlayers.map(p => p.uid))}
          />
        )}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_25rem] gap-8">
          {/* Left: the table, then the theme */}
          <section className="flex flex-col">
            <div className="flex items-baseline justify-between gap-3">
              <SectionLabel>The Table</SectionLabel>
              {tableHint && <span className="text-sm text-cream/50 text-right">{tableHint}</span>}
            </div>
            <div className="shrink-0 grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(7.5rem,auto)_auto] items-center justify-items-center gap-x-2">
              {/* The table top */}
              <div className="col-start-2 row-start-2 self-stretch w-full max-w-md rounded-[2.5rem] bg-felt shadow-[inset_0_2px_12px_rgb(0_0_0/0.35),0_0_0_10px_rgb(0_0_0/0.18),0_18px_40px_-12px_rgb(0_0_0/0.6)] flex flex-col items-center justify-center text-center gap-0.5 px-3">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-cream/50">Teams</span>
                {randomPartners ? (
                  <span className="font-display text-xl text-cream">Drawn at random</span>
                ) : (
                  <span className="font-display text-2xl whitespace-nowrap">
                    <span className="text-sky-300">N + S</span>
                    <span className="mx-2 text-base text-cream/50">vs</span>
                    <span className="text-amber-300">E + W</span>
                  </span>
                )}
                {hasAi ? (
                  <span className="text-sm text-amber-300/80" title={UNRATED_TITLE}>Unrated (bot)</span>
                ) : !randomPartners && roomElos && (roomElos.teamElos[0] != null || roomElos.teamElos[1] != null) && (
                  <span className="text-sm text-ochre-light/90 font-semibold tabular-nums" title="Pairing Elo">
                    {roomElos.teamElos[0] ?? '—'} vs {roomElos.teamElos[1] ?? '—'}
                  </span>
                )}
                {canRearrange && (
                  <button
                    onClick={() => { setSwapFrom(null); onShuffleSeats(); }}
                    disabled={playerCount < 2 || disconnectedSeats.length > 0}
                    className="btn btn-quiet mt-2 flex items-center gap-1.5 px-3 py-1 text-sm"
                  >
                    <Icon className="w-4 h-4"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></Icon>
                    Shuffle seats
                  </button>
                )}
              </div>
              {[0, 1, 2, 3].map(renderSeat)}
            </div>

            {pendingInvited.length > 0 && missing > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-cream/50 mr-1">Invited</span>
                {pendingInvited.map(p => (
                  <span key={p.uid} className="inline-flex items-center gap-1.5 surface rounded-full pl-1 pr-3 py-0.5 text-sm text-cream">
                    {p.photoURL ? (
                      <img src={p.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center">{p.displayName[0]}</span>
                    )}
                    {p.displayName}
                  </span>
                ))}
              </div>
            )}

            <SectionLabel className="mt-4">Theme</SectionLabel>
            <ThemeGallery
              compact
              value={gameState.settings.theme ?? 'papercraft'}
              onChange={theme => isOrganizer && onUpdateSettings({ theme })}
              disabled={!isOrganizer}
            />
          </section>

          {/* Right: rules, then start */}
          <section className="flex flex-col">
            <SectionLabel>House Rules{!isOrganizer && <span className="normal-case tracking-normal font-normal"> · set by the host</span>}</SectionLabel>
            <HouseRules
              randomPartners={randomPartners}
              onRandomPartnersChange={v => isOrganizer && onUpdateRandomPartners(v)}
              toggles={gameState.settings}
              onToggle={(key, value) => isOrganizer && onUpdateSettings({ [key]: value })}
              targetScore={gameState.settings.targetScore}
              onTargetScoreChange={v => isOrganizer && onUpdateSettings({ targetScore: v })}
              disabled={!isOrganizer}
              dense
            />
            <div className="mt-auto pt-4">
              <button
                onClick={onStartGame}
                disabled={!isOrganizer || missing > 0}
                className="btn btn-primary w-full py-3.5 !text-2xl"
              >
                {missing > 0
                  ? `Waiting for ${missing} more…`
                  : isOrganizer ? 'Start Game' : 'Waiting for the host…'}
              </button>
            </div>
          </section>
        </div>
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCancelConfirm(false)}>
          <div className="surface bg-felt-dark p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl text-cream">Cancel this room?</h2>
            <p className="text-cream/65 mt-1">Everyone will be sent back to the start screen.</p>
            <div className="flex justify-center gap-3 mt-5">
              <button onClick={() => setShowCancelConfirm(false)} className="btn btn-quiet px-5 py-2">Keep room</button>
              <button onClick={onCancelRoom} className="btn btn-bomb px-5 py-2">Cancel room</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
