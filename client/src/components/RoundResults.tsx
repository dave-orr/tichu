import { RoundResult, RoundHistoryEntry, ClientPlayer, Seat, EloUpdate } from '@tichu/shared';

type Props = {
  result: RoundResult;
  players: ClientPlayer[];
  onNextRound: () => void;
  isGameOver: boolean;
  mySeat: Seat;
  roundEndReady: Seat[];
  roundHistory: RoundHistoryEntry[];
  eloUpdate?: EloUpdate | null;
};

function tichuLabel(call: 'small' | 'grand', made: boolean) {
  const letter = call === 'grand' ? 'G' : 'T';
  // Color the letter by call identity (Tichu = green, Grand = blue); show the
  // outcome with a check/✗, consistent with the in-game Tichu badge.
  const idColor = call === 'grand' ? 'text-blue-400' : 'text-green-400';
  return (
    <span className={`${idColor} font-bold ml-1`}>
      {letter}
      <span className={made ? 'text-green-400' : 'text-red-500'}>{made ? '✓' : '✗'}</span>
    </span>
  );
}

function formatScore(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

function TeamHeader({ p1, p2, compact }: { p1: ClientPlayer; p2: ClientPlayer; compact?: boolean }) {
  const bothHavePhotos = p1.photoURL && p2.photoURL;
  if (bothHavePhotos) {
    const size = compact ? 'w-5 h-5' : 'w-6 h-6';
    return (
      <span className="inline-flex items-center gap-1">
        <img src={p1.photoURL!} alt="" className={`${size} rounded-full`} referrerPolicy="no-referrer" />
        <span className="text-gray-500 text-2xl">&</span>
        <img src={p2.photoURL!} alt="" className={`${size} rounded-full`} referrerPolicy="no-referrer" />
      </span>
    );
  }
  return <span>{p1.name} & {p2.name}</span>;
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function deltaColor(delta: number): string {
  return delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400';
}

export default function RoundResults({ result, players, onNextRound, isGameOver, mySeat, roundEndReady, roundHistory, eloUpdate }: Props) {
  const hasTichuBonus = result.tichuBonuses[0] !== 0 || result.tichuBonuses[1] !== 0;
  const iAmReady = roundEndReady.includes(mySeat);
  const readyCount = roundEndReady.length;

  function renderTichuIndicator(seat: Seat) {
    const call = players[seat].tichuCall;
    if (call === 'none') return null;
    const made = result.outOrder[0] === seat;
    return tichuLabel(call, made);
  }

  // Past rounds = all but the last entry (which is the current round)
  const pastRounds = roundHistory.slice(0, -1);
  const showHistory = pastRounds.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-4xl font-bold text-center mb-6 text-yellow-400">
          {isGameOver ? 'Game Over!' : 'Round Complete'}
        </h2>

        {result.isDoubleVictory && (
          <div className="text-center mb-4">
            <span className="text-4xl font-bold text-green-400">
              Double Victory!
            </span>
            <p className="text-gray-300">
              {players[(result.doubleVictoryTeam ?? 0) === 0 ? 0 : 1].name} &{' '}
              {players[(result.doubleVictoryTeam ?? 0) === 0 ? 2 : 3].name} went out 1st and 2nd!
            </p>
          </div>
        )}

        {/* Scoring table with aligned rows */}
        <table className="w-full mb-6 text-3xl">
          <thead>
            <tr>
              {[0, 1].map(team => (
                <th key={team} className="text-white font-semibold pb-2 w-1/2">
                  <TeamHeader p1={players[team === 0 ? 0 : 1]} p2={players[team === 0 ? 2 : 3]} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-center">
            <tr>
              {[0, 1].map(team => (
                <td key={team} className="py-1 text-gray-200">
                  Card points: <span className="font-bold">{result.teamScores[team]}</span>
                </td>
              ))}
            </tr>
            {hasTichuBonus && (
              <tr>
                {[0, 1].map(team => (
                  <td key={team} className={`py-1 ${
                    result.tichuBonuses[team] > 0 ? 'text-green-400' :
                    result.tichuBonuses[team] < 0 ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    {result.tichuBonuses[team] !== 0
                      ? `Tichu: ${result.tichuBonuses[team] > 0 ? '+' : ''}${result.tichuBonuses[team]}`
                      : '—'}
                  </td>
                ))}
              </tr>
            )}
            <tr>
              {[0, 1].map(team => (
                <td key={team} className="pt-2 border-t border-gray-600">
                  <span className="text-3xl font-bold text-white">
                    {result.totalScores[team]}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* Out order with tichu indicators */}
        <div className="text-center mb-6">
          <div className="text-3xl text-gray-400 mb-2">Out order</div>
          <div className="flex flex-col items-center gap-1">
            {result.outOrder.map((seat, i) => (
              <div key={seat} className={`text-3xl ${i === 0 ? 'text-yellow-400 font-bold' : 'text-gray-200'}`}>
                {i + 1}. {players[seat].name}{renderTichuIndicator(seat)}
              </div>
            ))}
          </div>
        </div>

        {/* Round history table */}
        {showHistory && (
          <div className="mb-6">
            <div className="text-3xl text-gray-400 text-center mb-2">Score History</div>
            <table className="w-full text-2xl">
              <thead>
                <tr className="text-gray-400 border-b border-gray-600">
                  <th className="py-1 text-left pl-2">Rd</th>
                  {[0, 1].map(team => (
                    <th key={team} className="py-1 text-right pr-2">
                      <TeamHeader
                        p1={players[team === 0 ? 0 : 1]}
                        p2={players[team === 0 ? 2 : 3]}
                        compact
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pastRounds.map(round => (
                  <tr key={round.roundNumber} className="border-b border-gray-700/50">
                    <td className="py-1 text-gray-400 pl-2">{round.roundNumber}</td>
                    {[0, 1].map(team => (
                      <td key={team} className="py-1 text-right pr-2">
                        <span className={
                          round.roundTotal[team] > 0 ? 'text-green-400' :
                          round.roundTotal[team] < 0 ? 'text-red-400' : 'text-gray-400'
                        }>
                          {formatScore(round.roundTotal[team])}
                        </span>
                        <span className="text-gray-500 ml-1">({round.cumulativeScores[team]})</span>
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Current round */}
                <tr className="bg-gray-700/30 font-bold">
                  <td className="py-1 text-yellow-400 pl-2">{roundHistory[roundHistory.length - 1].roundNumber}</td>
                  {[0, 1].map(team => {
                    const current = roundHistory[roundHistory.length - 1];
                    return (
                      <td key={team} className="py-1 text-right pr-2">
                        <span className={
                          current.roundTotal[team] > 0 ? 'text-green-400' :
                          current.roundTotal[team] < 0 ? 'text-red-400' : 'text-gray-400'
                        }>
                          {formatScore(current.roundTotal[team])}
                        </span>
                        <span className="text-white ml-1">({current.cumulativeScores[team]})</span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {isGameOver ? (
          <div className="text-center">
            <div className="text-4xl font-bold text-yellow-400 mb-4">
              {result.totalScores[0] > result.totalScores[1]
                ? `${players[0].name} & ${players[2].name} Win!`
                : `${players[1].name} & ${players[3].name} Win!`
              }
            </div>

            {eloUpdate && (eloUpdate.seatElos.some(e => e != null) || eloUpdate.teamElos.some(e => e != null)) && (
              <div className="bg-gray-900/60 rounded-lg p-3 mb-4">
                <div className="text-2xl text-gray-400 uppercase tracking-wide mb-2">Elo Ratings</div>
                <div className="grid grid-cols-2 gap-3">
                  {([0, 1] as const).map(team => {
                    const seats: [Seat, Seat] = team === 0 ? [0, 2] : [1, 3];
                    const teamElo = eloUpdate.teamElos[team];
                    const teamDelta = eloUpdate.teamDeltas[team];
                    return (
                      <div key={team} className="text-2xl">
                        <div className="text-gray-400 text-2xl mb-1">
                          <TeamHeader p1={players[seats[0]]} p2={players[seats[1]]} compact />
                        </div>
                        {teamElo != null && teamDelta != null && (
                          <div className="text-gray-200">
                            Pair: <span className="font-bold">{teamElo}</span>{' '}
                            <span className={deltaColor(teamDelta)}>({formatDelta(teamDelta)})</span>
                          </div>
                        )}
                        {seats.map(seat => {
                          const elo = eloUpdate.seatElos[seat];
                          const delta = eloUpdate.seatDeltas[seat];
                          if (elo == null || delta == null) return null;
                          return (
                            <div key={seat} className="text-gray-300 text-2xl">
                              {players[seat].name}: <span className="font-semibold">{elo}</span>{' '}
                              <span className={deltaColor(delta)}>({formatDelta(delta)})</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="mt-2 py-3 px-8 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-lg transition-colors"
            >
              New Game
            </button>
          </div>
        ) : iAmReady ? (
          <div className="text-center text-gray-400 py-3">
            Waiting for {players
              .filter(p => !roundEndReady.includes(p.seat))
              .map(p => p.name)
              .join(', ')}...
          </div>
        ) : (
          <button
            onClick={onNextRound}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-lg transition-colors"
          >
            Next Round
          </button>
        )}
      </div>
    </div>
  );
}
