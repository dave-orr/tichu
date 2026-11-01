import { useState } from 'react';
import { ClientPlayer, PointCardGroup } from '@tichu/shared';
import Card from './Card.js';

type Props = {
  groups: PointCardGroup[];
  players: ClientPlayer[];
};

function groupLabel(g: PointCardGroup, players: ClientPlayer[]): string {
  const name = (seat: number | null | undefined) => (seat == null ? '?' : players[seat].name);
  switch (g.source) {
    case 'won': return `${name(g.seat)}'s tricks`;
    case 'dragon': return `Dragon gift to ${name(g.seat)}`;
    case 'lastTricks': return `${name(g.from)}'s tricks → ${name(g.seat)}`;
    case 'lastHand': {
      const partner = g.team === 0 ? [0, 2] : [1, 3];
      return `${name(g.from)}'s hand → ${partner.map(name).join(' + ')}`;
    }
  }
}

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

/**
 * Expandable "where did the points go" panel under the round score: each
 * team's point cards, grouped by who won them and by the end-of-round
 * transfers (last player's tricks to first out, hand to the opponents,
 * Dragon gifts). Drawn with the theme's own cards, fanned so each corner
 * index shows.
 */
export default function PointCardBreakdown({ groups, players }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="mx-auto block py-1.5 px-4 text-2xl text-gray-300 hover:text-white bg-gray-900/60 hover:bg-gray-700 rounded-lg transition-colors"
      >
        {open ? 'Hide point cards ▴' : 'Show point cards ▾'}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-4 mt-3 text-left">
          {([0, 1] as const).map(team => {
            const teamGroups = groups.filter(g => g.team === team);
            return (
              <div key={team} className="space-y-3">
                {teamGroups.length === 0 && (
                  <div className="text-2xl text-gray-500 italic text-center">No point cards</div>
                )}
                {teamGroups.map((g, i) => (
                  <div key={i} className="bg-gray-900/60 rounded-lg p-2">
                    <div className="flex items-baseline justify-between gap-2 text-xl mb-1.5">
                      <span className="text-gray-300">{groupLabel(g, players)}</span>
                      <span className={`font-bold ${g.points < 0 ? 'text-red-400' : 'text-gray-100'}`}>
                        {formatPoints(g.points)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 pointer-events-none">
                      {/* 5s, 10s and Kings fan out with each corner index
                          showing; Dragon and Phoenix have no index, so they
                          sit beside the fan face up. */}
                      {g.cards.some(c => c.type === 'normal') && (
                        <div className="flex">
                          {g.cards.filter(c => c.type === 'normal').map((card, j) => (
                            <div key={j} className={j > 0 ? '-ml-[46px]' : ''}>
                              <Card card={card} small />
                            </div>
                          ))}
                        </div>
                      )}
                      {g.cards.filter(c => c.type === 'special').map((card, j) => (
                        <Card key={j} card={card} small />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
