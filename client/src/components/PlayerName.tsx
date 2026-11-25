import { BOT_NAME_SUFFIX } from '@tichu/shared';

/**
 * A player's name, truncated to fit, with a bot's " (AI)" suffix
 * (`shared/src/botNames.ts`) drawn as a smaller tag that never truncates, so a
 * long bot name still reads as a bot. Inherits font and colour from the parent.
 */
export default function PlayerName({ name, className = '' }: { name: string; className?: string }) {
  const isBot = name.endsWith(BOT_NAME_SUFFIX);
  const base = isBot ? name.slice(0, -BOT_NAME_SUFFIX.length) : name;
  return (
    <span className={`inline-flex min-w-0 max-w-full items-baseline ${className}`} title={name}>
      <span className="truncate">{base}</span>
      {isBot && <span className="ml-[0.3em] shrink-0 font-sans text-[0.55em] font-semibold opacity-70">(AI)</span>}
    </span>
  );
}
