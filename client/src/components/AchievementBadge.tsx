import { ACHIEVEMENTS, type AchievementId } from '@tichu/shared';

const DEFS = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

/** An achievement's badge art, with its name and description on hover. */
export default function AchievementBadge({ id, className = 'w-20 h-20', hint }: {
  id: AchievementId;
  className?: string;
  /** Extra line under the description, e.g. what clicking does. */
  hint?: string;
}) {
  const def = DEFS.get(id);
  return (
    <span className="relative group flex-shrink-0">
      <img
        src={`${import.meta.env.BASE_URL}achievements/${id}.svg`}
        alt={def ? `${def.name}: ${def.description}` : ''}
        className={`block ${className}`}
      />
      {def && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-yellow-600/60 bg-gray-950 px-3 py-2 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100"
        >
          <span className="block text-2xl font-bold text-yellow-400">{def.name}</span>
          <span className="block text-xl text-gray-200">{def.description}</span>
          {hint && <span className="block text-lg text-gray-400 mt-1">{hint}</span>}
        </span>
      )}
    </span>
  );
}
