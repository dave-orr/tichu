import { describe, it, expect } from 'vitest';
import { getScreenLeftSeat, getScreenRightSeat, playsClockwiseOnScreen } from './types.js';
import type { Seat } from './types.js';

describe('mirrored table seating', () => {
  it('draws +3 on the left and +1 on the right normally', () => {
    expect(getScreenLeftSeat(0)).toBe(3);
    expect(getScreenRightSeat(0)).toBe(1);
  });

  it('swaps the opponents when mirrored, keeping them opponents', () => {
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(getScreenLeftSeat(seat, true)).toBe((seat + 1) % 4);
      expect(getScreenRightSeat(seat, true)).toBe((seat + 3) % 4);
    }
  });

  it('flips the on-screen direction without changing the play direction', () => {
    expect(playsClockwiseOnScreen({ clockwise: false })).toBe(false);
    expect(playsClockwiseOnScreen({ clockwise: false, mirrorTable: true })).toBe(true);
    expect(playsClockwiseOnScreen({ clockwise: true })).toBe(true);
    expect(playsClockwiseOnScreen({ clockwise: true, mirrorTable: true })).toBe(false);
  });
});
