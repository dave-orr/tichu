import { useState, useEffect } from 'react';
import type { Seat, ClientGameState, InvitablePlayer, RoomElos } from '@tichu/shared';
import InvitePanel from './InvitePanel.js';

const SEAT_NAMES = ['North', 'East', 'South', 'West'];

type Props = {
  roomCode: string;
  gameState: ClientGameState;
  isOrganizer: boolean;
  randomPartners: boolean;
  hasProfile: boolean;
  aiOpenSeats: number[];
  disconnectedSeats: number[];
  onSwapSeats: (from: Seat, to: Seat) => void;
  onUpdateSettings: (settings: Record<string, boolean | number>) => void;
  onUpdateRandomPartners: (randomPartners: boolean) => void;
  onStartGame: () => void;
  onCancelRoom: () => void;
  onMarkSeatAi: (seat: Seat) => void;
  onUnmarkSeatAi: (seat: Seat) => void;
  fetchPlayers: () => Promise<{ players: InvitablePlayer[] }>;
  fetchRoomElos: () => Promise<RoomElos>;
  sendInvite: (targetUid: string) => void;
  expiredInviteUids: Set<string>;
};

export default function WaitingRoom({
  roomCode, gameState, isOrganizer, randomPartners, hasProfile,
  aiOpenSeats, disconnectedSeats, onSwapSeats, onUpdateSettings, onUpdateRandomPartners, onStartGame,
  onCancelRoom, onMarkSeatAi, onUnmarkSeatAi,
  fetchPlayers, fetchRoomElos, sendInvite, expiredInviteUids,
}: Props) {
  const [swapFrom, setSwapFrom] = useState<Seat | null>(null);
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

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* clipboard unavailable — ignore */ });
  };

  const playerCount = gameState.players.filter(p => p.name).length;
  const canSwapSeats = isOrganizer && !randomPartners && playerCount >= 2;
  // Games with any AI player are unrated — nobody gains or loses Elo.
  const hasAi = gameState.players.some(p => p.isAi) || aiOpenSeats.length > 0;

  // Refetch Elo ratings whenever the seated players change (joins, swaps, etc.).
  const seatSignature = gameState.players.map(p => p.id || '').join('|');
  useEffect(() => {
    let cancelled = false;
    fetchRoomElos().then(elos => { if (!cancelled) setRoomElos(elos); });
    return () => { cancelled = true; };
  }, [fetchRoomElos, seatSignature]);

  const handleSeatClick = (seat: Seat) => {
    if (!canSwapSeats) return;
    if (!gameState.players[seat].name) return;
    if (swapFrom === null) {
      setSwapFrom(seat);
    } else if (swapFrom === seat) {
      setSwapFrom(null);
    } else {
      onSwapSeats(swapFrom, seat);
      setSwapFrom(null);
    }
  };

  // One seat card in the table diagram. Team is by seat parity: N+S (0, 2)
  // vs E+W (1, 3), tinted to match the center "vs" cell.
  const renderSeat = (i: number) => {
    const p = gameState.players[i];
    const seat = i as Seat;
    const isSelected = swapFrom === i;
    const isSwappable = canSwapSeats && p.name;
    const isAiOpen = aiOpenSeats.includes(i);
    const isAiPlayer = p.isAi;
    const isDisconnected = disconnectedSeats.includes(i);
    const teamClass = i % 2 === 0 ? 'text-sky-300' : 'text-amber-300';
    return (
      <div
        onClick={() => handleSeatClick(seat)}
        className={`min-h-[88px] p-2 rounded-lg flex flex-col items-center justify-center text-center transition-colors ${
          isAiPlayer ? 'bg-blue-700' : p.name ? 'bg-green-700' : isAiOpen ? 'bg-blue-900 border border-blue-500' : 'bg-gray-700/80'
        } ${isSelected ? 'ring-2 ring-yellow-400' : ''} ${
          isSwappable ? 'cursor-pointer hover:bg-green-600' : ''
        }`}
      >
        <span className={`text-lg uppercase tracking-wider font-semibold ${teamClass}`}>
          {SEAT_NAMES[i]}
          {isAiPlayer && <span className="ml-1 text-blue-300 normal-case tracking-normal">(Bot)</span>}
        </span>
        {p.name ? (
          <span className="text-2xl font-semibold max-w-full truncate">{p.name}</span>
        ) : (
          <span className="text-xl text-gray-300 italic max-w-full truncate">
            {isAiOpen ? 'Bot joining…' : 'Open seat'}
          </span>
        )}
        {p.name && roomElos?.seatElos[i] != null && (
          <span className="text-lg text-yellow-300/90 font-semibold">{roomElos.seatElos[i]} Elo</span>
        )}
        {isDisconnected && (
          <span className="text-lg text-amber-300 italic">reconnecting…</span>
        )}
        {!p.name && isOrganizer && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              isAiOpen ? onUnmarkSeatAi(seat) : onMarkSeatAi(seat);
            }}
            className={`mt-1 text-xs px-2 py-0.5 rounded transition-colors ${
              isAiOpen
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
            }`}
          >
            {isAiOpen ? 'Cancel AI' : 'Open for AI'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-2 sm:p-4">
      <div className="bg-felt rounded-xl shadow-2xl w-full max-w-5xl p-4 lg:p-6">
        {/* Header: title left, room code + copy + invite right */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 mb-3">
          <h1 className="text-4xl font-bold">Tichu</h1>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-lg uppercase tracking-wider text-gray-400">Room code</div>
              <div className="hidden lg:block text-base text-gray-400">share it to seat friends</div>
            </div>
            <span className="text-5xl font-mono font-bold tracking-widest text-yellow-400">
              {roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              title={copied ? 'Copied!' : 'Copy room code'}
              aria-label="Copy room code"
              className="p-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
            >
              {copied ? (
                <svg className="w-7 h-7 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
            {isOrganizer && playerCount < 4 && hasProfile && (
              <button
                onClick={() => setShowInvitePanel(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
              >
                Invite Players
              </button>
            )}
            {isOrganizer && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="px-3 py-2 text-gray-400 hover:text-red-400 transition-colors"
              >
                Cancel room
              </button>
            )}
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

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          {/* Left: the table, laid out as a table — N top, W/E flanking, S bottom */}
          <div>
            <h3 className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-2xl font-semibold text-gray-400">Players ({playerCount}/4)</span>
              {canSwapSeats && (
                <span className="text-base text-gray-500 text-right">
                  {swapFrom !== null
                    ? `Click another player to swap with ${gameState.players[swapFrom].name}`
                    : 'Click two players to swap seats'}
                </span>
              )}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div />
              {renderSeat(0)}
              <div />
              {renderSeat(3)}
              {/* Center: teams at a glance */}
              <div className="rounded-lg bg-black/25 flex flex-col items-center justify-center text-center p-2 gap-0.5">
                {randomPartners ? (
                  <>
                    <span className="text-lg uppercase tracking-wider text-gray-400">Teams</span>
                    <span className="text-xl font-semibold text-gray-200">Random at start</span>
                    {hasAi && (
                      <span className="text-base text-amber-300/80" title="Games with a bot are unrated — no Elo is won or lost.">
                        Unrated (bot)
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-lg uppercase tracking-wider text-gray-400">Teams</span>
                    <span className="text-xl font-semibold text-sky-300 whitespace-nowrap">N + S</span>
                    <span className="text-base text-gray-400">vs</span>
                    <span className="text-xl font-semibold text-amber-300 whitespace-nowrap">E + W</span>
                    {hasAi ? (
                      <span className="text-base text-amber-300/80" title="Games with a bot are unrated — no Elo is won or lost.">
                        Unrated (bot)
                      </span>
                    ) : roomElos && (roomElos.teamElos[0] != null || roomElos.teamElos[1] != null) && (
                      <span className="text-lg text-yellow-300/90 font-semibold" title="Pairing Elo">
                        {roomElos.teamElos[0] ?? '—'} vs {roomElos.teamElos[1] ?? '—'}
                      </span>
                    )}
                  </>
                )}
              </div>
              {renderSeat(1)}
              <div />
              {renderSeat(2)}
              <div />
            </div>

            {pendingInvited.length > 0 && playerCount < 4 && (
              <div className="mt-3">
                <p className="text-lg text-gray-400 uppercase tracking-wide mb-1">
                  Invited — waiting to join
                </p>
                <div className="flex flex-wrap gap-2">
                  {pendingInvited.map(p => (
                    <span
                      key={p.uid}
                      className="inline-flex items-center gap-1.5 bg-gray-800 border border-gray-600 rounded-full pl-1 pr-3 py-0.5 text-xl"
                    >
                      {p.photoURL ? (
                        <img src={p.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center">
                          {p.displayName[0]}
                        </span>
                      )}
                      {p.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: setup options + start */}
          <div className="flex flex-col gap-2">
            <h3 className="text-2xl font-semibold text-gray-400">Setup Options</h3>
            {/* Descriptions hide below lg (title tooltips take over) so the
                whole card fits short viewports without scrolling. */}
            <label
              title="Randomly assign teams when the game starts"
              className={`flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-600 ${isOrganizer ? 'cursor-pointer' : 'opacity-70'}`}
            >
              <input
                type="checkbox"
                checked={randomPartners}
                onChange={e => isOrganizer && onUpdateRandomPartners(e.target.checked)}
                disabled={!isOrganizer}
                className="w-4 h-4 shrink-0 rounded accent-yellow-500"
              />
              <div className="text-left leading-snug">
                <span className="text-xl font-semibold">Random Partners</span>
                <p className="hidden lg:block text-base text-gray-400">Randomly assign teams when the game starts</p>
              </div>
            </label>
            {[
              { key: 'countPoints' as const, label: 'Count Points', desc: 'Show captured point totals by each player\'s name' },
              { key: 'cardsSeen' as const, label: 'Cards Seen', desc: 'Show how many of each card remain unplayed' },
              { key: 'showPassedCards' as const, label: 'Show Passed Cards', desc: 'Show the cards you passed and received, beside your hand' },
              { key: 'clockwise' as const, label: 'Clockwise Play', desc: 'Play passes clockwise instead of counterclockwise' },
            ].map(opt => (
              <label
                key={opt.key}
                title={opt.desc}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-600 ${isOrganizer ? 'cursor-pointer' : 'opacity-70'}`}
              >
                <input
                  type="checkbox"
                  checked={gameState.settings[opt.key]}
                  onChange={e => isOrganizer && onUpdateSettings({ [opt.key]: e.target.checked })}
                  disabled={!isOrganizer}
                  className="w-4 h-4 shrink-0 rounded accent-yellow-500"
                />
                <div className="text-left leading-snug">
                  <span className="text-xl font-semibold">{opt.label}</span>
                  <p className="hidden lg:block text-base text-gray-400">{opt.desc}</p>
                </div>
              </label>
            ))}
            <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-600 ${isOrganizer ? '' : 'opacity-70'}`}>
              <div className="flex-1 text-left leading-snug">
                <span className="text-xl font-semibold">Target Score</span>
                <p className="hidden lg:block text-base text-gray-400">Points needed to win</p>
              </div>
              <input
                type="number"
                value={gameState.settings.targetScore}
                onChange={e => isOrganizer && onUpdateSettings({ targetScore: Math.max(100, Math.min(9999, Number(e.target.value) || 1000)) })}
                disabled={!isOrganizer}
                min={100}
                max={9999}
                step={50}
                className="w-24 py-1 px-2 bg-gray-700 border border-gray-500 rounded text-center text-white text-xl disabled:opacity-50"
              />
            </div>

            <div className="mt-auto pt-2">
              {playerCount === 4 && isOrganizer && (
                <button
                  onClick={onStartGame}
                  className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-lg transition-colors"
                >
                  Start Game
                </button>
              )}
              {playerCount === 4 && !isOrganizer && (
                <p className="text-gray-400 text-xl text-center">Waiting for host to start the game...</p>
              )}
              {playerCount < 4 && (
                <p className="text-gray-500 text-xl text-center">
                  Waiting for {4 - playerCount} more player{4 - playerCount === 1 ? '' : 's'}…
                </p>
              )}

              {isOrganizer && showCancelConfirm && (
                <div className="mt-2 space-y-2 text-center">
                  <p className="text-xl text-gray-300">
                    Cancel the room and remove everyone?
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={onCancelRoom}
                      className="py-2 px-6 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
                    >
                      Yes, cancel room
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="py-2 px-6 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold transition-colors"
                    >
                      Keep room
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
