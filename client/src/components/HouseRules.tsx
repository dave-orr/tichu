import TargetScoreInput, { TARGET_SCORE_MAX, TARGET_SCORE_MIN } from './TargetScoreInput.js';

export type RuleToggle = 'countPoints' | 'cardsSeen' | 'showPassedCards' | 'clockwise';

export const RULES: { key: RuleToggle; name: string; description: string }[] = [
  { key: 'countPoints', name: 'Count Points', description: "Show captured point totals by each player's name" },
  { key: 'cardsSeen', name: 'Cards Seen', description: 'Show how many of each card remain unplayed' },
  { key: 'showPassedCards', name: 'Show Passed Cards', description: 'Show the cards you passed and received, beside your hand' },
  { key: 'clockwise', name: 'Clockwise Play', description: 'Play passes clockwise instead of counterclockwise' },
];

const TARGET_STEP = 100;

/** Small uppercase heading over a section of the create / waiting screens. */
export function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-sm font-sans font-bold uppercase tracking-[0.18em] text-cream/55 mb-3 ${className}`}>{children}</h2>;
}

/** A row in the rules list: name and description, with a switch on the right. */
function SwitchRow({ name, description, checked, disabled, dense, onChange }: {
  name: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  dense?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-4 px-5 ${dense ? 'py-2' : 'py-2.5'} transition-colors ${disabled ? '' : 'cursor-pointer hover:bg-white/5'}`}>
      <div className="flex-1 min-w-0">
        <div className="text-lg font-semibold text-cream leading-tight">{name}</div>
        <p className="text-sm text-cream/60 leading-snug mt-0.5">{description}</p>
      </div>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="switch-track relative shrink-0 w-12 h-7 rounded-full bg-black/40 ring-1 ring-cream/15 transition-colors peer-checked:bg-ochre peer-checked:ring-ochre-dark peer-disabled:opacity-60 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ochre after:absolute after:top-1 after:left-1 after:w-5 after:h-5 after:rounded-full after:bg-paper after:shadow after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

function StepButton({ label, disabled, onClick, children }: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="btn btn-quiet w-11 h-11 flex items-center justify-center">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/**
 * The room's rule switches and target score, shared by the create screen and
 * the waiting room. `disabled` shows them read-only (non-organizers).
 */
export default function HouseRules({
  randomPartners, onRandomPartnersChange, toggles, onToggle, targetScore, onTargetScoreChange, disabled, dense,
}: {
  randomPartners: boolean;
  onRandomPartnersChange: (value: boolean) => void;
  toggles: Record<RuleToggle, boolean>;
  onToggle: (key: RuleToggle, value: boolean) => void;
  targetScore: number;
  onTargetScoreChange: (value: number) => void;
  disabled?: boolean;
  /** Tighter rows, for the waiting room where the panel shares the column. */
  dense?: boolean;
}) {
  return (
    <div className="surface overflow-hidden divide-y divide-cream/10">
      <SwitchRow
        name="Random Partners"
        description="Randomly assign teams when the game starts"
        checked={randomPartners}
        disabled={disabled}
        dense={dense}
        onChange={onRandomPartnersChange}
      />
      {RULES.map(r => (
        <SwitchRow
          key={r.key}
          name={r.name}
          description={r.description}
          checked={toggles[r.key]}
          disabled={disabled}
          dense={dense}
          onChange={checked => onToggle(r.key, checked)}
        />
      ))}
      <div className={`px-5 ${dense ? 'py-3' : 'py-4'}`}>
        <div className="text-lg font-semibold text-cream leading-tight">Target Score</div>
        <p className="text-sm text-cream/60 leading-snug mt-0.5">Points needed to win the game</p>
        <div className="flex items-center gap-2 mt-3">
          {!disabled && (
            <StepButton label="Lower target score" disabled={targetScore <= TARGET_SCORE_MIN} onClick={() => onTargetScoreChange(Math.max(TARGET_SCORE_MIN, targetScore - TARGET_STEP))}>
              <line x1="5" y1="12" x2="19" y2="12" />
            </StepButton>
          )}
          <TargetScoreInput
            value={targetScore}
            onCommit={onTargetScoreChange}
            disabled={disabled}
            className="flex-1 min-w-0 py-1.5 rounded-lg text-center text-2xl font-display font-semibold tabular-nums bg-black/30 text-cream border border-transparent focus:outline-none focus:border-ochre disabled:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {!disabled && (
            <StepButton label="Raise target score" disabled={targetScore >= TARGET_SCORE_MAX} onClick={() => onTargetScoreChange(Math.min(TARGET_SCORE_MAX, targetScore + TARGET_STEP))}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </StepButton>
          )}
        </div>
      </div>
    </div>
  );
}
