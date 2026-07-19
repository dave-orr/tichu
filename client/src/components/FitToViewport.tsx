import { useEffect, useState, type ReactNode } from 'react';

/** The comfortable "design size" of the in-game UI: the middle table row
 *  (two 440px player panels + center status) sets the width, and the three
 *  panel rows plus the large hand and action buttons set the height. */
const DESIGN_WIDTH = 1150;
const DESIGN_HEIGHT = 900;

function useViewportSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/**
 * Uniformly scales the game UI down so its full design size fits the
 * viewport — small windows (e.g. high-DPI displays at 300% OS scaling, where
 * innerHeight can be ~550px) see the whole table and action buttons with no
 * scrolling or overlap, just proportionally smaller. Windows at least as
 * large as the design size render at scale 1, i.e. exactly as before.
 *
 * Children must size themselves with h-full (not h-screen/min-h-screen):
 * inside the scaled subtree, viewport units would resolve against the real
 * viewport and come out too small by the scale factor. Fixed-position
 * overlays are fine as-is — the transform makes them position against this
 * wrapper, whose logical box maps exactly onto the viewport.
 */
export default function FitToViewport({ children }: { children: ReactNode }) {
  const { w, h } = useViewportSize();
  const scale = Math.min(1, w / DESIGN_WIDTH, h / DESIGN_HEIGHT);
  return (
    <div className="h-screen w-screen overflow-hidden">
      <div
        style={{
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
