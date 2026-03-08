import { Seat, getTeamForSeat, getLeftSeat, getRightSeat, ClientPlayer } from '@tichu/shared';

type Props = {
  mySeat: Seat;
  players: ClientPlayer[];
  onGive: (to: Seat) => void;
};

export default function DragonGiveaway({ mySeat, players, onGive }: Props) {
  const myTeam = getTeamForSeat(mySeat);
  const leftSeat = getLeftSeat(mySeat);
  const rightSeat = getRightSeat(mySeat);
  // Order: left opponent first, right opponent second
  const opponents = [leftSeat, rightSeat]
    .filter(s => getTeamForSeat(s) !== myTeam)
    .map(s => players[s]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl max-w-sm w-full">
        <h3 className="text-xl font-bold text-center mb-4 text-purple-400">
          Dragon Won the Trick
        </h3>
        <p className="text-gray-300 text-base text-center mb-4">
          You must give the trick to one of your opponents.
        </p>
        <div className="flex gap-4 justify-center">
          {opponents.map((opp, i) => (
            <button
              key={opp.seat}
              onClick={() => onGive(opp.seat)}
              className="py-3 px-6 bg-purple-700 hover:bg-purple-600 rounded-lg font-bold transition-colors flex flex-col items-center"
            >
              <span>{opp.name}</span>
              <span className="text-sm text-purple-300 font-normal">
                {i === 0 ? '← Left' : 'Right →'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
