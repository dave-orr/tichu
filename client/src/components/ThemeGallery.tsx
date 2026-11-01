import { THEMES, type Card, type Theme } from '@tichu/shared';
import CardComponent from './Card.js';
import { ThemeContext, cardArt, faceArt, hasFullFaces } from '../theme.js';

// The little hand fanned on each tile: the specials show each theme's art at
// its most distinctive, and the King shows its court portraits.
const FAN: Card[] = [
  { type: 'special', name: 'phoenix' },
  { type: 'normal', suit: 'star', rank: 13 },
  { type: 'special', name: 'dragon' },
];
// Resting and hover angles/offsets for the three cards (left, middle, right).
const REST = ['-rotate-[12deg] -translate-x-10 translate-y-2', '-translate-y-1', 'rotate-[12deg] translate-x-10 translate-y-2'];
const SPREAD = ['group-hover:-rotate-[16deg] group-hover:-translate-x-14', 'group-hover:-translate-y-3', 'group-hover:rotate-[16deg] group-hover:translate-x-14'];
// Compact (waiting room) tiles fan small cards more tightly.
const REST_COMPACT = ['-rotate-[12deg] -translate-x-7 translate-y-1', '', 'rotate-[12deg] translate-x-7 translate-y-1'];
const SPREAD_COMPACT = ['group-hover:-rotate-[16deg] group-hover:-translate-x-9', 'group-hover:-translate-y-1.5', 'group-hover:rotate-[16deg] group-hover:translate-x-9'];

/**
 * The compact tile's fan, drawn from the art files rather than Card. The
 * waiting room is already inside the room's [data-theme], and theme CSS rules
 * (`[data-theme=kawaii] .card`...) match any ancestor, so a real Card here
 * would pick up the room's styling instead of its own tile's. Colour
 * variables are safe: they resolve from the nearest [data-theme].
 */
function CompactFan({ theme, interactive }: { theme: Theme; interactive: boolean }) {
  return (
    <>
      {FAN.map((card, i) => {
        const src = hasFullFaces(theme)
          ? faceArt(theme, card)
          : card.type === 'special' ? cardArt(theme, `${card.name}.svg`) : cardArt(theme, `royal-K-${card.suit}.svg`);
        return (
          <div
            key={i}
            className={`absolute w-12 h-[72px] rounded-md overflow-hidden shadow-[0_3px_8px_-2px_rgb(0_0_0/0.5)] transition-transform duration-300 ease-out origin-bottom ${REST_COMPACT[i]} ${interactive ? SPREAD_COMPACT[i] : ''} ${hasFullFaces(theme) ? '' : 'bg-paper p-1 ring-1 ring-black/10'}`}
            style={{ zIndex: i === 1 ? 2 : 1 }}
          >
            <img src={src} alt="" draggable={false} className={`w-full h-full ${hasFullFaces(theme) ? '' : 'object-contain'}`} />
          </div>
        );
      })}
    </>
  );
}

/**
 * Theme choice for the create-room screen (and, compact, the waiting room): one tile per theme, each a small
 * table drawn in that theme (its felt, fonts and real cards), so the choice
 * shows exactly what the game will look like. Tile size never depends on
 * the selection, so picking a theme doesn't reflow the page.
 */
export default function ThemeGallery({ value, onChange, compact, disabled }: {
  value: Theme;
  onChange: (theme: Theme) => void;
  /** Waiting-room size: small cards, name only (description as a tooltip). */
  compact?: boolean;
  /** Read-only (non-organizers): only the chosen theme is highlighted. */
  disabled?: boolean;
}) {
  return (
    <div className={`grid gap-4 ${compact ? '' : 'h-full'} ${compact ? 'grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]' : 'grid-cols-1 sm:grid-cols-2'}`} role="radiogroup" aria-label="Theme">
      {THEMES.filter(t => t.selectable || t.id === value).map(t => {
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={compact ? t.description : undefined}
            disabled={disabled}
            onClick={() => onChange(t.id)}
            className={`group relative rounded-2xl p-1 text-left transition-all duration-200 ${
              selected
                ? 'bg-ochre shadow-[0_0_0_1px_rgb(var(--c-ochre)),0_12px_32px_-8px_rgb(var(--c-ochre)/0.55)]'
                : disabled ? 'bg-white/10 opacity-60' : 'bg-white/10 hover:bg-white/20 hover:-translate-y-0.5'
            }`}
          >
            {/* The theme's own variables apply inside this scope. */}
            <div
              data-theme={t.id}
              className={`rounded-xl overflow-hidden flex flex-col h-full ${
                compact ? 'min-h-[7.5rem] bg-[radial-gradient(ellipse_at_50%_40%,rgb(var(--c-felt))_0%,rgb(var(--c-felt-dark))_100%)]' : 'table-felt min-h-[20rem] lg:min-h-[17rem]'
              }`}
            >
              <ThemeContext.Provider value={t.id}>
                <div className={`relative flex-1 flex items-center justify-center pointer-events-none ${compact ? 'pt-2' : 'pt-4 scale-[1.2]'}`} aria-hidden="true">
                  {compact ? <CompactFan theme={t.id} interactive={!disabled} /> : FAN.map((card, i) => (
                    <div
                      key={i}
                      className={`absolute transition-transform duration-300 ease-out origin-bottom ${REST[i]} ${SPREAD[i]}`}
                      style={{ zIndex: i === 1 ? 2 : 1 }}
                    >
                      <CardComponent card={card} />
                    </div>
                  ))}
                </div>
              </ThemeContext.Provider>
              {compact ? (
                <div className="px-3 pb-2 pt-1 font-display text-lg leading-tight text-cream truncate">{t.name}</div>
              ) : (
                <div className="px-4 pb-4 pt-2">
                  <div className="font-display text-2xl leading-tight text-cream">{t.name}</div>
                  <p className="text-sm leading-snug text-cream/75 h-10 line-clamp-2">{t.description}</p>
                </div>
              )}
            </div>
            {selected && (
              <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-ochre text-ink flex items-center justify-center shadow-lg ring-4 ring-felt-dark">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
