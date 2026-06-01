import { describe, it, expect } from 'vitest';
import {
  eloExpected, eloKFactor,
  ELO_INITIAL, ELO_DIVISOR, ELO_K_PROVISIONAL, ELO_PROVISIONAL_GAMES, ELO_K_STANDARD,
} from './types.js';

describe('eloExpected', () => {
  it('is 0.5 for equal ratings', () => {
    expect(eloExpected(1500, 1500)).toBeCloseTo(0.5, 10);
  });

  it('gives ~91% to a player 400 points higher', () => {
    expect(eloExpected(1900, 1500)).toBeCloseTo(0.909, 3);
  });

  it('is symmetric: expectations sum to 1', () => {
    const a = eloExpected(1620, 1480);
    const b = eloExpected(1480, 1620);
    expect(a + b).toBeCloseTo(1, 10);
  });

  it('uses a 400-point divisor', () => {
    // A one-divisor advantage should be a factor of 10 in the odds.
    const e = eloExpected(1500 + ELO_DIVISOR, 1500);
    expect(e / (1 - e)).toBeCloseTo(10, 6);
  });
});

describe('eloKFactor', () => {
  it('uses the provisional K while below the provisional game count', () => {
    expect(eloKFactor(0)).toBe(ELO_K_PROVISIONAL);
    expect(eloKFactor(ELO_PROVISIONAL_GAMES - 1)).toBe(ELO_K_PROVISIONAL);
  });

  it('switches to the standard K once established', () => {
    expect(eloKFactor(ELO_PROVISIONAL_GAMES)).toBe(ELO_K_STANDARD);
    expect(eloKFactor(100)).toBe(ELO_K_STANDARD);
  });
});

describe('rating update math', () => {
  it('a clear favorite gains little for an expected win', () => {
    const exp = eloExpected(1700, 1300);
    const gain = Math.round(ELO_K_STANDARD * (1 - exp));
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThan(5); // ~2 points
  });

  it('an upset win is worth a large swing', () => {
    const exp = eloExpected(1300, 1700);
    const gain = Math.round(ELO_K_STANDARD * (1 - exp));
    expect(gain).toBeGreaterThan(20); // ~22 points
  });

  it('a win and the mirrored loss are zero-sum at equal K', () => {
    const expA = eloExpected(1500, 1500);
    const winnerGain = ELO_K_STANDARD * (1 - expA);
    const loserLoss = ELO_K_STANDARD * (0 - expA);
    expect(winnerGain + loserLoss).toBeCloseTo(0, 10);
  });

  it('defaults a fresh rating to 1500', () => {
    expect(ELO_INITIAL).toBe(1500);
  });
});
