import { useEffect, useState } from 'react';
import type { GameSummary } from '@tichu/shared';

/**
 * When the signed-in player last finished a game, as of when this page was
 * opened. Games finished during this visit don't move it, so the "What's new"
 * highlight stays put between games instead of emptying after each one.
 */
const PAGE_OPENED_AT = Date.now();

// One fetch per signed-in user per page load: the lobby remounts after every game.
const cache = new Map<string, Promise<number | null>>();

export type LastPlayed =
  | { status: 'loading' }
  | { status: 'ready'; at: number | null };

export function useLastPlayed(
  uid: string | null | undefined,
  connected: boolean,
  fetchRecentGames: () => Promise<{ games: GameSummary[] }>,
): LastPlayed {
  const [state, setState] = useState<LastPlayed>({ status: 'loading' });

  useEffect(() => {
    if (!uid || !connected) return;
    let promise = cache.get(uid);
    if (!promise) {
      promise = fetchRecentGames()
        .then(({ games }) => {
          const before = games.map(g => g.finishedAt).filter(t => t > 0 && t < PAGE_OPENED_AT);
          return before.length ? Math.max(...before) : null;
        })
        .catch(() => null);
      cache.set(uid, promise);
      // An empty answer may just mean the socket wasn't signed in yet: ask
      // again next time rather than remembering "never played".
      promise.then(at => { if (at === null) cache.delete(uid); });
    }
    let cancelled = false;
    promise.then(at => { if (!cancelled) setState({ status: 'ready', at }); });
    return () => { cancelled = true; };
  }, [uid, connected, fetchRecentGames]);

  return uid ? state : { status: 'ready', at: null };
}
