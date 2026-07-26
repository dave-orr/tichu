import { useState, useEffect, useRef } from 'react';
import { RANK_NAMES, NormalRank } from '@tichu/shared';

type Props = {
  wish: NormalRank | null;
};

export default function WishDisplay({ wish }: Props) {
  const [displayWish, setDisplayWish] = useState<NormalRank | null>(null);
  const [evaporating, setEvaporating] = useState(false);
  const prevWish = useRef<NormalRank | null>(null);
  const evaporateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (wish !== null) {
      // A live wish always cancels any pending evaporation clear — otherwise a
      // wish set again mid-animation would be wiped when the old timer fires.
      if (evaporateTimer.current) {
        clearTimeout(evaporateTimer.current);
        evaporateTimer.current = null;
      }
      setDisplayWish(wish);
      setEvaporating(false);
    } else if (prevWish.current !== null) {
      // Wish just fulfilled — start evaporate animation
      setEvaporating(true);
      evaporateTimer.current = setTimeout(() => {
        evaporateTimer.current = null;
        setDisplayWish(null);
        setEvaporating(false);
      }, 800);
    }
    prevWish.current = wish;
  }, [wish]);

  useEffect(() => () => {
    if (evaporateTimer.current) clearTimeout(evaporateTimer.current);
  }, []);

  if (displayWish === null) return null;

  return (
    <div className={`flex flex-col items-center gap-1 ${evaporating ? 'wish-evaporate' : 'wish-appear'}`}>
      <div className="text-2xl text-yellow-400/80 font-medium tracking-wide uppercase">Wish</div>
      <div className="w-16 h-24 rounded-lg border-2 border-yellow-400 bg-yellow-50 shadow-lg shadow-yellow-400/20 flex items-center justify-center">
        <span className="text-3xl font-black text-yellow-700">
          {RANK_NAMES[displayWish]}
        </span>
      </div>
    </div>
  );
}
