import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildReplayFrames, cardId, identifyCombo, comboLabel, RANK_NAMES, aiAgrees, aiPassAgrees, aiSuggestionLabel,
  type AiDecision, type AiPass, type AiSuggestion, type Card, type HandReplay, type ReplayFrame, type ReviewSession, type Seat,
} from '@tichu/shared';
import OpenHand, { type OpenHandMark } from './OpenHand.js';
import SeatPlay from './SeatPlay.js';
import TichuBadge from './TichuBadge.js';
import PlayerName from './PlayerName.js';

type Props = {
  review: ReviewSession;
  mySeat: Seat;
  mirrored: boolean;
  isOrganizer: boolean;
  /** Move the table's shared position. */
  onStep: (step: number) => void;
  /** The server can ask the AI engine about this hand. */
  aiAvailable: boolean;
  /** Ask the server for the AI's suggestions (once per hand; the answer comes with the review). */
  onRequestAi: () => void;
  /** Organizer: close the review for everyone. */
  onEnd: () => void;
  /** Go back to the results screen (just for me). */
  onShowResults: () => void;
};

/** Fewest ms between shared-position updates while scrubbing (server allows 20/s). */
const SEND_EVERY_MS = 80;
const ORDINALS = ['', '1st', '2nd', '3rd', '4th'];
const AI_PREF_KEY = 'tichu.reviewAi';

/** One line about a seat from the AI, shown under its name. */
type AiNote = { text: string; tone: 'next' | 'agree' | 'differ' };

function cardName(card: Card): string {
  if (card.type === 'normal') return RANK_NAMES[card.rank];
  return { mahjong: 'Mah Jong', dog: 'Dog', phoenix: 'Phoenix', dragon: 'Dragon' }[card.name] ?? card.name;
}

/** "would play Pair, 9s" / "would have passed" etc. */
function aiWould(s: AiSuggestion, names: string[], past: boolean): string {
  const have = past ? 'would have' : 'would';
  switch (s.type) {
    case 'play': return `AI ${have} ${past ? 'played' : 'play'} ${aiSuggestionLabel(s, names)}`;
    case 'pass': return `AI ${have} ${past ? 'passed' : 'pass'}`;
    case 'wish': return s.rank != null ? `AI ${have} ${past ? 'wished' : 'wish'} for ${RANK_NAMES[s.rank]}` : `AI ${have} ${past ? 'made' : 'make'} no wish`;
    case 'dragon': return `AI ${have} ${past ? 'given' : 'give'} the Dragon to ${names[s.to]}`;
  }
}

function passText(p: AiPass, names: string[]): string {
  const to = (seat: number) => names[seat % 4];
  // left = seat+3, partner = seat+2, right = seat+1 (shared/src/types.ts seat helpers)
  return `${cardName(p.left)} → ${to(p.seat + 3)} · ${cardName(p.partner)} → ${to(p.seat + 2)} · ${cardName(p.right)} → ${to(p.seat + 1)}`;
}

/**
 * The AI's notes and card marks for one frame: on the deal, what each seat
 * would have passed; before a decision, what the AI would do (its cards
 * ringed in the decider's hand); on the decision, whether the player did the
 * same; at the end, how often each player matched it.
 */
function aiFrameNotes(frame: ReplayFrame, replay: HandReplay, passes: AiPass[], decisions: Map<number, AiDecision>) {
  // Short names in the notes: a bot's " (AI)" tag reads badly next to "the AI".
  const names = replay.names.map(n => n.replace(/ \(AI\)$/, ''));
  const notes: AiNote[][] = [[], [], [], []];
  const marks: Map<string, OpenHandMark>[] = [0, 1, 2, 3].map(() => new Map());
  if (frame.kind === 'deal') {
    for (const p of passes) {
      notes[p.seat].push({ text: `AI would pass ${passText(p, names)}`, tone: aiPassAgrees(replay.passes[p.seat], p) ? 'agree' : 'next' });
    }
  }
  if (frame.action != null) {
    const d = decisions.get(frame.action);
    const a = replay.actions[frame.action];
    if (d && a) {
      notes[d.seat].push(aiAgrees(a, d.suggestion)
        ? { text: 'Same as the AI', tone: 'agree' }
        : { text: aiWould(d.suggestion, names, true), tone: 'differ' });
    }
  }
  const next = frame.kind === 'passed' ? 0 : frame.action != null ? frame.action + 1 : frame.kind === 'deal' && replay.passes.every(p => !p) ? 0 : null;
  const upcoming = next != null ? decisions.get(next) : undefined;
  if (upcoming) {
    notes[upcoming.seat].push({ text: `Next: ${aiWould(upcoming.suggestion, names, false)}`, tone: 'next' });
    if (upcoming.suggestion.type === 'play') {
      for (const c of upcoming.suggestion.cards) marks[upcoming.seat].set(cardId(c), { label: 'AI', title: 'The AI would play this', tone: 'ai' });
    }
  }
  if (frame.kind === 'end') {
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      let asked = 0;
      let same = 0;
      const p = passes.find(x => x.seat === seat);
      if (p) { asked++; if (aiPassAgrees(replay.passes[seat], p)) same++; }
      for (const d of decisions.values()) {
        if (d.seat !== seat || !replay.actions[d.action]) continue;
        asked++;
        if (aiAgrees(replay.actions[d.action], d.suggestion)) same++;
      }
      if (asked) notes[seat].push({ text: `Matched the AI on ${same} of ${asked} decisions`, tone: 'next' });
    }
  }
  return { notes, marks };
}

function readAiPref(): boolean {
  try { return localStorage.getItem(AI_PREF_KEY) === '1'; } catch { return false; }
}
function writeAiPref(on: boolean) {
  try { localStorage.setItem(AI_PREF_KEY, on ? '1' : '0'); } catch { /* private mode */ }
}

/**
 * "Review in learning mode": the hand that just ended, every hand face up,
 * stepped through one action at a time. The table shares one position, so
 * whoever moves it moves everyone; "Look on my own" detaches you to browse,
 * and "Show everyone" brings the table to the moment you're looking at.
 */
export default function HandReview({ review, mySeat, mirrored, isOrganizer, onStep, aiAvailable, onRequestAi, onEnd, onShowResults }: Props) {
  const frames = useMemo(() => buildReplayFrames(review.replay), [review.replay]);
  const last = frames.length - 1;
  const clamp = useCallback((n: number) => Math.max(0, Math.min(last, n)), [last]);
  const [solo, setSolo] = useState(false);
  const [step, setStepState] = useState(() => clamp(review.step));
  const names = review.replay.names;

  // Follow the table, except for echoes of my own moves (they can arrive
  // behind where I've already scrubbed to).
  // Only a move by someone else pulls me along: leaving "on my own" goes
  // through the buttons below, which set the step themselves.
  const soloRef = useRef(solo);
  soloRef.current = solo;
  useEffect(() => {
    if (!soloRef.current && review.by !== mySeat) setStepState(clamp(review.step));
  }, [review.step, review.by, mySeat, clamp]);

  // Throttled send with a trailing update, so a fast scrub stays under the
  // server's rate limit and still lands everyone on the final position.
  const pending = useRef<number | null>(null);
  const lastSent = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = useCallback((n: number) => {
    pending.current = n;
    const flush = () => {
      timer.current = null;
      if (pending.current == null) return;
      lastSent.current = Date.now();
      onStep(pending.current);
      pending.current = null;
    };
    const wait = SEND_EVERY_MS - (Date.now() - lastSent.current);
    if (wait <= 0) flush();
    else if (!timer.current) timer.current = setTimeout(flush, wait);
  }, [onStep]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const go = useCallback((n: number) => {
    const next = clamp(n);
    setStepState(next);
    if (!solo) send(next);
  }, [clamp, solo, send]);

  // Trick boundaries, for the jump buttons: the first frame of each trick.
  const trickStarts = useMemo(() => frames.flatMap((f, i) =>
    (f.kind === 'play' || f.kind === 'bomb') && f.trick.length === 1 ? [i] : []), [frames]);
  const prevTrick = () => go([...trickStarts].reverse().find(i => i < step) ?? 0);
  const nextTrick = () => go(trickStarts.find(i => i > step) ?? last);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? nextTrick() : go(step + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? prevTrick() : go(step - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(last); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const frame = frames[step];
  const relOf = (seat: Seat) => {
    const rel = (seat - mySeat + 4) % 4;
    return mirrored && rel % 2 === 1 ? 4 - rel : rel;
  };
  const seatAt = (rel: number) => ([0, 1, 2, 3] as Seat[]).find(s => relOf(s) === rel)!;
  const top = frame.trick.length ? frame.trick[frame.trick.length - 1] : null;
  const topCombo = top ? identifyCombo(top.cards) : null;
  const movedBy = !solo && review.by != null && review.by !== mySeat && review.step === step ? names[review.by] : null;

  // AI suggestions: each player chooses whether to see them; the first to
  // turn them on has the server ask the engine, for the whole table.
  const [showAi, setShowAi] = useState(() => aiAvailable && readAiPref());
  const ai = review.ai ?? null;
  const askedFor = useRef<HandReplay | null>(null);
  useEffect(() => {
    if (!showAi || !aiAvailable || (ai && ai.status !== 'error') || askedFor.current === review.replay) return;
    askedFor.current = review.replay;
    onRequestAi();
  }, [showAi, aiAvailable, ai, review.replay, onRequestAi]);
  const toggleAi = () => {
    // On, after a failure: the button retries.
    if (showAi && ai?.status === 'error') { askedFor.current = review.replay; onRequestAi(); return; }
    const on = !showAi;
    setShowAi(on);
    writeAiPref(on);
    if (on && ai?.status === 'error') { askedFor.current = review.replay; onRequestAi(); }
  };
  const ready = showAi && ai?.status === 'ready' ? ai : null;
  const decisions = useMemo(() => new Map((ready?.decisions ?? []).map(d => [d.action, d])), [ready]);
  const aiView = ready ? aiFrameNotes(frame, review.replay, ready.passes, decisions) : null;

  const seatProps = (seat: Seat) => ({
    seat, frame, names, active: frame.seat === seat,
    aiNotes: showAi ? aiView?.notes[seat] ?? [] : undefined,
    aiMarks: aiView?.marks[seat],
  });

  return (
    <div className="h-full flex flex-col review-mode">
      {/* Banner */}
      <div className="shrink-0 flex items-center justify-center gap-3 pt-2 px-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-ochre px-4 py-1 text-lg font-extrabold uppercase tracking-[0.15em] text-ink">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
          </svg>
          Reviewing hand {review.replay.roundNumber}
        </span>
        <span className="text-cream/55 text-lg">All hands face up</span>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto flex px-2">
        <div className="m-auto w-full flex flex-col gap-3 py-2">
          <div className="flex justify-center"><ReviewSeat {...seatProps(seatAt(2))} wide /></div>
          <div className="flex items-center justify-between gap-3">
            <ReviewSeat {...seatProps(seatAt(3))} />
            <div className="flex flex-col items-center justify-center gap-2 px-2 min-w-[200px] max-w-[280px] text-center">
              {frame.wish != null && (
                <div className="rounded-full bg-black/30 px-4 py-1 text-2xl font-bold text-ochre-light">Wish: {RANK_NAMES[frame.wish]}</div>
              )}
              {topCombo ? (
                <div>
                  <div className="text-lg uppercase tracking-[0.2em] text-cream/50 font-bold">To beat</div>
                  <div className="font-display text-cream/85 font-semibold text-3xl">{comboLabel(topCombo)}</div>
                </div>
              ) : frame.kind !== 'deal' && frame.kind !== 'passed' && frame.kind !== 'end' ? (
                <div className="font-display text-3xl text-cream/50 italic">Table clear</div>
              ) : null}
            </div>
            <ReviewSeat {...seatProps(seatAt(1))} mirror />
          </div>
          <div className="flex justify-center"><ReviewSeat {...seatProps(seatAt(0))} wide /></div>
        </div>
      </div>

      {/* Scrubber */}
      <div className="shrink-0 p-3 bg-black/30 border-t border-cream/10">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <div className="font-display text-3xl text-cream font-semibold truncate" aria-live="polite">{frame.text}</div>
            <div className="shrink-0 text-xl text-cream/60 tabular-nums">
              {movedBy && <span className="mr-3 text-ochre-light">moved by {movedBy}</span>}
              {step} / {last}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={last}
            value={step}
            onChange={e => go(Number(e.target.value))}
            className="review-scrubber w-full accent-[rgb(var(--c-ochre))] h-3 cursor-pointer"
            aria-label="Position in the hand"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <ScrubButton label="Start of the hand" onClick={() => go(0)} disabled={step === 0}><Icon d="M6 5v14M19 5l-10 7 10 7z" /></ScrubButton>
              <ScrubButton label="Previous trick (Shift+←)" onClick={prevTrick} disabled={step === 0}><Icon d="M11 5l-8 7 8 7zM21 5l-8 7 8 7z" /></ScrubButton>
              <ScrubButton label="Back one step (←)" onClick={() => go(step - 1)} disabled={step === 0}><Icon d="M16 5l-10 7 10 7z" /></ScrubButton>
              <ScrubButton label="Forward one step (→)" onClick={() => go(step + 1)} disabled={step === last}><Icon d="M8 5l10 7-10 7z" /></ScrubButton>
              <ScrubButton label="Next trick (Shift+→)" onClick={nextTrick} disabled={step === last}><Icon d="M3 5l8 7-8 7zM13 5l8 7-8 7z" /></ScrubButton>
              <ScrubButton label="End of the hand" onClick={() => go(last)} disabled={step === last}><Icon d="M18 5v14M5 5l10 7-10 7z" /></ScrubButton>
            </div>
            <div className="flex items-center gap-2">
              {solo ? (
                <>
                  <span className="text-lg text-cream/60 mr-1">Looking on your own</span>
                  <button className="btn btn-primary px-4 py-2 text-lg" onClick={() => { onStep(step); setSolo(false); }} title="Move everyone to the moment you're looking at">
                    Show everyone this
                  </button>
                  <button className="btn btn-quiet px-4 py-2 text-lg" onClick={() => { setSolo(false); setStepState(clamp(review.step)); }}>
                    Back to the table
                  </button>
                </>
              ) : (
                <button className="btn btn-quiet px-4 py-2 text-lg" onClick={() => setSolo(true)} title="Browse without moving everyone else">
                  Look on my own
                </button>
              )}
              <AiToggle available={aiAvailable} on={showAi} ai={ai} onToggle={toggleAi} />
              <button className="btn btn-quiet px-4 py-2 text-lg" onClick={onShowResults}>Results</button>
              {isOrganizer && (
                <button className="btn btn-quiet px-4 py-2 text-lg" onClick={onEnd} title="Close the review for everyone">End review</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function ScrubButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className="btn btn-quiet w-12 h-11 text-xl flex items-center justify-center" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      {children}
    </button>
  );
}

function AiToggle({ available, on, ai, onToggle }: { available: boolean; on: boolean; ai: ReviewSession['ai']; onToggle: () => void }) {
  const working = on && ai?.status === 'working';
  const error = on && ai?.status === 'error' ? ai.message : null;
  const title = !available
    ? "The AI engine isn't installed on this server"
    : error ? `${error}. Click to try again.`
      : on ? 'Hide what the AI would have done' : 'Show what the AI would have done at each decision';
  return (
    <button
      type="button"
      className={`btn px-4 py-2 text-lg inline-flex items-center gap-2 ${on && available ? 'btn-primary' : 'btn-quiet'}`}
      onClick={onToggle}
      disabled={!available}
      aria-pressed={on && available}
      title={title}
    >
      <svg className={`w-5 h-5 ${working ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {working
          ? <path d="M21 12a9 9 0 1 1-6.2-8.6" />
          : <><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 3v4M9 12h.01M15 12h.01M9.5 15.5h5" /></>}
      </svg>
      {working ? 'AI is thinking…' : error ? 'AI failed, retry' : 'AI suggestions'}
    </button>
  );
}

const NOTE_TONE = {
  next: 'bg-sky-400/20 text-sky-300',
  agree: 'bg-good/15 text-good',
  differ: 'bg-sky-400/20 text-sky-300',
};

function ReviewSeat({ seat, frame, names, active, mirror, wide, aiNotes, aiMarks }: {
  seat: Seat; frame: ReplayFrame; names: string[]; active: boolean; mirror?: boolean;
  /** AI suggestions are on: this seat's notes (a reserved line, so the table doesn't jump). */
  aiNotes?: AiNote[];
  aiMarks?: ReadonlyMap<string, OpenHandMark>;
  /** Top and bottom seats: the play sits beside the hand rather than above it. */
  wide?: boolean;
}) {
  const play = [...frame.trick].reverse().find(t => t.seat === seat);
  const place = frame.out[seat];
  const passed = frame.passedSeats.includes(seat);
  const marks = new Map<string, OpenHandMark>();
  for (const p of frame.passing) {
    if (frame.kind === 'deal' && p.from === seat) {
      marks.set(cardId(p.card), { label: `→${names[p.to].slice(0, 1)}`, title: `Passed to ${names[p.to]}`, tone: 'out' });
    } else if (frame.kind === 'passed' && p.to === seat) {
      marks.set(cardId(p.card), { label: `${names[p.from].slice(0, 1)}→`, title: `Passed by ${names[p.from]}`, tone: 'in' });
    }
  }
  // The AI's suggested cards win over the pass marks: they're what to look at next.
  for (const [id, m] of aiMarks ?? []) marks.set(id, m);
  const identity = (
    <div className={`flex items-center gap-3 ${mirror ? 'flex-row-reverse' : ''}`}>
      <PlayerName name={names[seat]} className={`font-display font-semibold text-3xl leading-tight ${active ? 'text-ochre-light' : 'text-cream'}`} />
      <TichuBadge call={frame.calls[seat]} />
      {place > 0 && <span className="text-lg font-extrabold uppercase tracking-[0.15em] text-good">Out · {ORDINALS[place]}</span>}
      {passed && <span className="text-base font-bold uppercase tracking-[0.15em] text-cream/60 bg-black/25 rounded-full px-2.5">Passed</span>}
    </div>
  );
  const notes = aiNotes && (
    <div className={`flex flex-col gap-1 min-h-[28px] ${mirror ? 'items-end' : 'items-start'}`}>
      {aiNotes.map((n, i) => (
        <span key={i} className={`rounded-full px-3 py-0.5 text-lg font-semibold leading-snug ${NOTE_TONE[n.tone]}`}>
          {n.tone === 'agree' && <span aria-hidden="true">✓ </span>}{n.text}
        </span>
      ))}
    </div>
  );
  const playBox = (
    <div className={`flex items-center justify-center ${wide ? 'min-w-[150px] min-h-[104px]' : 'min-h-[104px]'}`}>
      {play && (
        <SeatPlay
          key={`${frame.trick.length}-${play.cards.map(cardId).join('|')}`}
          cards={play.cards}
          isTopOfTrick={frame.topSeat === seat}
          combo={identifyCombo(play.cards)}
        />
      )}
    </div>
  );
  const hand = <OpenHand cards={frame.hands[seat]} marks={marks} emptyLabel="No cards left" />;
  return (
    <div
      className={`relative flex gap-3 rounded-2xl px-4 py-2.5 transition-[box-shadow,background-color] duration-150 ${
        wide ? 'items-end' : `flex-col min-w-[460px] ${mirror ? 'items-end' : ''}`
      } ${active ? 'bg-ochre/10 ring-[3px] ring-ochre' : 'bg-black/15 ring-1 ring-cream/10'}`}
    >
      {wide ? (
        <>
          <div className="flex flex-col gap-1.5 min-w-[430px]">{identity}{notes}{hand}</div>
          {playBox}
        </>
      ) : (
        <>
          <div className={`flex items-center gap-3 w-full ${mirror ? 'flex-row-reverse' : ''}`}>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">{identity}{notes}</div>
            {playBox}
          </div>
          {hand}
        </>
      )}
    </div>
  );
}
