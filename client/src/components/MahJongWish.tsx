import { NormalRank, RANK_NAMES } from '@tichu/shared';

type Props = {
  onWish: (rank: NormalRank) => void;
};

const RANKS: NormalRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export default function MahJongWish({ onWish }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl max-w-sm w-full">
        <h3 className="text-xl font-bold text-center mb-4 text-yellow-400">
          Mah Jong Wish
        </h3>
        <p className="text-gray-300 text-base text-center mb-4">
          Name a card rank that opponents must play when they can.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {RANKS.map(rank => (
            <button
              key={rank}
              onClick={() => onWish(rank)}
              className="py-2 px-3 bg-gray-700 hover:bg-yellow-600 rounded-lg font-bold transition-colors"
            >
              {RANK_NAMES[rank]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
