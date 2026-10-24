import { THEMES, type Theme } from '@tichu/shared';
import { cardArt, faceArt, hasFullFaces } from '../theme.js';

// Each theme's Dragon card stock (the .special-dragon tint in index.css). The
// preview sits outside that theme's [data-theme] scope, so it can't inherit it.
const DRAGON_STOCK: Record<Theme, string> = {
  papercraft: '#EAF4E6',
  kawaii: '#EAFBF2',
  halloween: '#E8F4DC',
  baroque: '#FBF5E6',
};

/** A small Dragon card in the theme's art, so each option shows its look. */
function ThemePreview({ theme, compact }: { theme: Theme; compact?: boolean }) {
  const size = compact ? 'w-8 h-12' : 'w-12 h-[72px]';
  if (hasFullFaces(theme)) {
    return <img src={faceArt(theme, { type: 'special', name: 'dragon' })} alt="" className={`${size} shrink-0 rounded object-cover`} />;
  }
  return (
    <span className={`${size} shrink-0 rounded flex items-center justify-center p-0.5`} style={{ backgroundColor: DRAGON_STOCK[theme] }}>
      <img src={cardArt(theme, 'dragon.svg')} alt="" className="w-full h-full object-contain" />
    </span>
  );
}

/** Vertical choice list of table theme (GameSettings.theme), set by the room creator. */
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
      <div className="flex flex-col rounded-xl bg-gray-900/60 p-1 gap-1" role="radiogroup" aria-label="Theme">
        {THEMES.filter(t => t.selectable || t.id === value).map(t => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={value === t.id}
            title={t.description}
            disabled={disabled}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-3 rounded-lg px-2 py-1 text-left font-bold ${compact ? 'text-base' : 'text-xl'} transition-colors ${
              value === t.id ? 'bg-ochre text-ink' : 'text-cream/70 hover:text-cream disabled:hover:text-cream/70'
            }`}
          >
            <ThemePreview theme={t.id} compact={compact} />
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
