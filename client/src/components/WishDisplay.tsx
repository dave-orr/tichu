import { useState, useEffect, useRef } from 'react';
import { RANK_NAMES, NormalRank } from '@tichu/shared';

type Props = {
  wish: NormalRank | null;
};

export default function WishDisplay({ wish }: Props) {
  const [displayWish, setDisplayWish] = useState<NormalRank | null>(null);
  const [evaporating, setEvaporating] = useState(false);
  const prevWish = useRef<NormalRank | null>(null);

  useEffect(() => {
    if (wish !== null && prevWish.current === null) {
      // Wish just appeared
      setDisplayWish(wish);
      setEvaporating(false);
    } else if (wish === null && prevWish.current !== null) {
      // Wish just fulfilled — start evaporate animation
      setEvaporating(true);
      setTimeout(() => {
        setDisplayWish(null);
        setEvaporating(false);
      }, 800);
    } else if (wish !== null) {
      setDisplayWish(wish);
    }
    prevWish.current = wish;
  }, [wish]);

  if (displayWish === null) return null;

  return (
    <div className={`flex flex-col items-center gap-1 ${evaporating ? 'wish-evaporate' : 'wish-appear'}`}>
      <div className="text-sm text-yellow-400/80 font-medium tracking-wide uppercase">Wish</div>
      <div className="w-16 h-24 rounded-lg border-2 border-yellow-400 bg-yellow-50 shadow-lg shadow-yellow-400/20 flex items-center justify-center">
        <span className="text-3xl font-black text-yellow-700">
          {RANK_NAMES[displayWish]}
        </span>
      </div>
    </div>
  );
}
