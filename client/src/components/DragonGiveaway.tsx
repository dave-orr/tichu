import { Seat, getTeamForSeat, getScreenLeftSeat, getScreenRightSeat, ClientPlayer } from '@tichu/shared';

type Props = {
  mySeat: Seat;
  /** The table is drawn mirrored, so the opponents sit on the other sides. */
  mirrored?: boolean;
  players: ClientPlayer[];
  onGive: (to: Seat) => void;
};

export default function DragonGiveaway({ mySeat, mirrored, players, onGive }: Props) {
  const myTeam = getTeamForSeat(mySeat);
  const leftSeat = getScreenLeftSeat(mySeat, mirrored);
  const rightSeat = getScreenRightSeat(mySeat, mirrored);
  // Order: the opponent on screen left first, then the one on the right
  const opponents = [leftSeat, rightSeat]
    .filter(s => getTeamForSeat(s) !== myTeam)
    .map(s => players[s]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 ring-1 ring-cream/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full">
        <h3 className="text-4xl font-bold text-center mb-4 text-dragon">
          Dragon Won the Trick
        </h3>
        <p className="text-gray-300 text-3xl text-center mb-4">
          You must give the trick to one of your opponents.
        </p>
        <div className="flex gap-4 justify-center">
          {opponents.map((opp, i) => (
            <button
              key={opp.seat}
              onClick={() => onGive(opp.seat)}
              className="py-3 px-6 btn btn-pass flex flex-col items-center"
            >
              <span>{opp.name}</span>
              <span className="text-sm text-ink/60 font-semibold">
                {i === 0 ? '← Left' : 'Right →'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
