import { Seat, getTeamForSeat, ClientPlayer } from '@tichu/shared';

type Props = {
  mySeat: Seat;
  players: ClientPlayer[];
  onGive: (to: Seat) => void;
};

export default function DragonGiveaway({ mySeat, players, onGive }: Props) {
  const myTeam = getTeamForSeat(mySeat);
  const opponents = players.filter(p => getTeamForSeat(p.seat) !== myTeam);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl max-w-sm w-full">
        <h3 className="text-xl font-bold text-center mb-4 text-purple-400">
          Dragon Won the Trick
        </h3>
        <p className="text-gray-300 text-sm text-center mb-4">
          You must give the trick to one of your opponents.
        </p>
        <div className="flex gap-4 justify-center">
          {opponents.map(opp => (
            <button
              key={opp.seat}
              onClick={() => onGive(opp.seat)}
              className="py-3 px-6 bg-purple-700 hover:bg-purple-600 rounded-lg font-bold transition-colors"
            >
              {opp.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
