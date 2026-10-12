import { THEMES, type Theme } from '@tichu/shared';

/** Segmented choice of table theme (GameSettings.theme), set by the room creator. */
export default function ThemePicker({ value, onChange, disabled, compact }: {
  value: Theme;
  onChange: (theme: Theme) => void;
  disabled?: boolean;
  /** Waiting-room size: smaller type, descriptions only as tooltips below lg. */
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 rounded-lg bg-gray-800 border border-gray-600 ${compact ? 'px-3 py-1.5' : 'p-3'} ${disabled ? 'opacity-70' : ''}`}>
      <div className="text-left leading-snug">
        <span className={`${compact ? 'text-xl' : ''} font-semibold`}>Theme</span>
        <p className={compact ? 'hidden lg:block text-base text-gray-400' : 'text-2xl text-gray-400'}>
          {THEMES.find(t => t.id === value)?.description}
        </p>
      </div>
      <div className="flex self-start rounded-full bg-gray-900/60 p-1 gap-1" role="radiogroup" aria-label="Theme">
        {THEMES.filter(t => t.selectable || t.id === value).map(t => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={value === t.id}
            title={t.description}
            disabled={disabled}
            onClick={() => onChange(t.id)}
            className={`rounded-full px-3 py-1 font-bold ${compact ? 'text-base' : 'text-xl'} transition-colors ${
              value === t.id ? 'bg-ochre text-ink' : 'text-cream/70 hover:text-cream disabled:hover:text-cream/70'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
