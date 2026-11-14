import { useEffect, useMemo } from 'react';
import {
  CHANGELOG, addedLine, changelogLine, changelogTime, splitChangelog, summarizeChangelog,
  type ChangelogEntry, type ChangelogKind,
} from '@tichu/shared';
import type { LastPlayed } from '../hooks/useLastPlayed.js';

const KIND_LABEL: Record<ChangelogKind, string> = {
  new: 'New',
  improved: 'Better',
  fixed: 'Fix',
  internal: 'Internal',
};

const KIND_STYLE: Record<ChangelogKind, string> = {
  new: 'bg-ochre/25 text-ochre-light',
  improved: 'bg-sky-400/20 text-sky-300',
  fixed: 'bg-good/20 text-good',
  internal: 'bg-white/10 text-cream/55',
};

const fmtDay = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtMonth = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** How many lines the "since your last game" section has (0 = nothing new). */
export function whatsNewCount(lastPlayed: LastPlayed): number {
  if (lastPlayed.status !== 'ready' || lastPlayed.at == null) return 0;
  const { since } = splitChangelog(CHANGELOG, lastPlayed.at);
  const s = summarizeChangelog(since);
  return s.listed.length + (s.achievements > 0 ? 1 : 0) + (s.themes > 0 ? 1 : 0);
}

function Sparkle({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

/** The button that opens the panel, with a count of what's new since the last game. */
export function WhatsNewButton({ count, onClick, className = '', labelClassName = '' }: {
  count: number; onClick: () => void; className?: string; labelClassName?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={count > 0 ? `${count} update${count === 1 ? '' : 's'} since your last game` : 'What’s new'}
      aria-label="What’s new"
      className={`btn btn-quiet relative flex items-center gap-2 ${className}`}
    >
      <Sparkle />
      <span className={labelClassName}>What’s new</span>
      {count > 0 && (
        <span className="min-w-6 h-6 px-1.5 rounded-full bg-ochre text-ink text-sm font-extrabold leading-6 tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

function Row({ entry, line }: { entry: ChangelogEntry; line: string }) {
  return (
    <li className="flex items-baseline gap-2 sm:gap-3 py-1">
      <span className={`shrink-0 w-[4.5rem] sm:w-24 text-center rounded-full px-1 py-0.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider ${KIND_STYLE[entry.kind]}`}>
        {KIND_LABEL[entry.kind]}
      </span>
      <span className={`flex-1 ${entry.kind === 'internal' ? 'text-cream/55' : 'text-cream'}`}>{line}</span>
      <span className="shrink-0 text-sm text-cream/40 tabular-nums">#{entry.pr}</span>
    </li>
  );
}

type Props = {
  lastPlayed: LastPlayed;
  signedIn: boolean;
  onClose: () => void;
};

export default function WhatsNew({ lastPlayed, signedIn, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lastAt = lastPlayed.status === 'ready' ? lastPlayed.at : null;
  const { since, earlier } = useMemo(() => splitChangelog(CHANGELOG, lastAt), [lastAt]);
  const sinceSummary = summarizeChangelog(since);
  const sinceAdded = [
    sinceSummary.themes > 0 ? addedLine(sinceSummary.themes, 0) : null,
    sinceSummary.achievements > 0 ? addedLine(0, sinceSummary.achievements) : null,
  ].filter((l): l is string => !!l);

  // Earlier changes, grouped by month.
  const months: { label: string; entries: ChangelogEntry[] }[] = [];
  for (const e of earlier) {
    const label = fmtMonth(changelogTime(e));
    if (months[months.length - 1]?.label !== label) months.push({ label, entries: [] });
    months[months.length - 1].entries.push(e);
  }

  let intro: string | null = null;
  if (!signedIn) intro = 'Sign in to see what’s changed since your last game.';
  else if (lastPlayed.status === 'loading') intro = 'Checking when you last played…';
  else if (lastAt == null) intro = 'You haven’t finished a game yet, so here’s everything so far.';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="What’s new"
        className="bg-felt-dark rounded-2xl ring-1 ring-ochre/40 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 text-left"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-3xl text-ochre-light flex items-center gap-2"><Sparkle className="w-7 h-7" /> What’s new</h2>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="p-2 text-cream/60 hover:text-cream rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {intro ? (
          <p className="text-cream/70 mb-4">{intro}</p>
        ) : (
          <section className="rounded-xl ring-2 ring-ochre bg-ochre/10 p-4 mb-5">
            <h3 className="text-xl font-bold text-ochre-light">
              Since your last game <span className="font-normal text-cream/60">· {fmtDay(lastAt!)}</span>
            </h3>
            {since.length === 0 ? (
              <p className="text-cream/70 mt-2">Nothing new yet. Check back soon!</p>
            ) : (
              <ul className="mt-2">
                {sinceAdded.map(line => (
                  <li key={line} className="flex items-center gap-2 py-1 text-lg font-bold text-cream">
                    <Sparkle className="w-5 h-5 text-ochre-light" /> {line}
                  </li>
                ))}
                {sinceSummary.listed.map(e => <Row key={e.pr} entry={e} line={e.summary!} />)}
              </ul>
            )}
          </section>
        )}

        {months.length > 0 && (
          <section>
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-cream/50 mb-1">
              {intro ? 'All updates' : 'Earlier'}
            </h3>
            {months.map(m => (
              <div key={m.label} className="mt-3">
                <h4 className="text-cream/70 font-semibold border-b border-white/10 pb-1 mb-1">{m.label}</h4>
                <ul>
                  {m.entries.map(e => <Row key={e.pr} entry={e} line={changelogLine(e)} />)}
                </ul>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
