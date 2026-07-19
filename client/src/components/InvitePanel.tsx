import { useState, useEffect } from 'react';
import type { InvitablePlayer } from '@tichu/shared';

type Props = {
  onClose: () => void;
  fetchPlayers: () => Promise<{ players: InvitablePlayer[] }>;
  sendInvite: (targetUid: string) => void;
  expiredInviteUids: Set<string>;
  /** Called when a player is invited, so a parent can persist/show the list. */
  onInvite?: (player: InvitablePlayer) => void;
  /** Players already invited (tracked by a parent), so the panel keeps showing
   *  them as "Invited" even after it's been closed and reopened. */
  invitedUids?: Set<string>;
};

export default function InvitePanel({ onClose, fetchPlayers, sendInvite, expiredInviteUids, onInvite, invitedUids }: Props) {
  const [players, setPlayers] = useState<InvitablePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  // Revert "Invited" state when server notifies of expiry
  useEffect(() => {
    if (expiredInviteUids.size === 0) return;
    setInvited(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const uid of expiredInviteUids) {
        if (next.delete(uid)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [expiredInviteUids]);

  useEffect(() => {
    fetchPlayers().then(({ players }) => {
      setPlayers(players);
      setLoading(false);
    });
  }, [fetchPlayers]);

  const handleInvite = (player: InvitablePlayer) => {
    sendInvite(player.uid);
    setInvited(prev => new Set(prev).add(player.uid));
    onInvite?.(player);
  };

  // Split into played-with and others for section headers
  const playedWith = players.filter(p => p.playedWith);
  const others = players.filter(p => !p.playedWith);

  const renderPlayer = (p: InvitablePlayer) => {
    const isInvited = invited.has(p.uid) || !!invitedUids?.has(p.uid);
    const buttonLabel = isInvited
      ? 'Invited'
      : p.isOnline && !p.isAvailable
        ? 'In Game'
        : 'Invite';
    const canInvite = !isInvited && !(p.isOnline && !p.isAvailable);

    return (
      <div key={p.uid} className="flex items-center justify-between p-2 rounded-lg bg-gray-700">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            p.isAvailable ? 'bg-green-400' : p.isOnline ? 'bg-yellow-400' : 'bg-gray-500'
          }`} />
          {p.photoURL ? (
            <img src={p.photoURL} alt="" className="w-8 h-8 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-2xl flex-shrink-0">
              {p.displayName[0]}
            </div>
          )}
          <span className="text-2xl truncate">{p.displayName}</span>
        </div>
        <button
          onClick={() => handleInvite(p)}
          disabled={!canInvite}
          className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed flex-shrink-0 ml-2 transition-colors"
        >
          {buttonLabel}
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-5 max-w-sm w-full max-h-[80%] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-3xl font-bold">Invite Players</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">Loading players...</p>
        ) : players.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No other registered players found.</p>
        ) : (
          <div className="overflow-y-auto space-y-1">
            {playedWith.length > 0 && (
              <>
                <div className="text-2xl text-gray-400 font-semibold uppercase tracking-wide px-1 pt-1">
                  Played before
                </div>
                {playedWith.map(renderPlayer)}
              </>
            )}
            {others.length > 0 && (
              <>
                <div className="text-2xl text-gray-400 font-semibold uppercase tracking-wide px-1 pt-2">
                  {playedWith.length > 0 ? 'Others' : 'All Players'}
                </div>
                {others.map(renderPlayer)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
