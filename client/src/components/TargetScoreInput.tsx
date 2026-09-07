import { useEffect, useRef, useState } from 'react';

export const TARGET_SCORE_MIN = 100;
export const TARGET_SCORE_MAX = 9999;

type Props = {
  value: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Number field for the target score that only clamps when the user is done
 * typing. Clamping on every keystroke made the field impossible to type into
 * ("5" on the way to "500" became 100, and clearing it snapped to 1000).
 */
export default function TargetScoreInput({ value, onCommit, disabled, className }: Props) {
  const [draft, setDraft] = useState(String(value));
  const focusedRef = useRef(false);

  // Follow external changes (another organizer edit, a server round-trip)
  // unless the user is mid-edit. Keyed on `value` alone so committing (which
  // sets the draft first and only changes `value` a round-trip later) doesn't
  // flash the old number in between.
  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) && draft.trim() !== ''
      ? Math.max(TARGET_SCORE_MIN, Math.min(TARGET_SCORE_MAX, Math.round(parsed)))
      : value;
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <input
      type="number"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onFocus={() => { focusedRef.current = true; }}
      onBlur={() => { focusedRef.current = false; commit(); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      disabled={disabled}
      min={TARGET_SCORE_MIN}
      max={TARGET_SCORE_MAX}
      step={50}
      className={className}
    />
  );
}
