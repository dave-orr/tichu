import { describe, it, expect } from 'vitest';
import { BOT_NAMES, BOT_NAME_SUFFIX, BOT_NAME_MAX_LENGTH, pickBotName } from './botNames.js';

describe('bot names', () => {
  it('has at least 50 distinct names', () => {
    expect(BOT_NAMES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(BOT_NAMES).size).toBe(BOT_NAMES.length);
  });

  it('keeps every name short enough for the seat panels', () => {
    for (const n of BOT_NAMES) expect(n.length).toBeLessThanOrEqual(BOT_NAME_MAX_LENGTH);
  });

  it('appends (AI)', () => {
    expect(pickBotName([], () => 0)).toBe(BOT_NAMES[0] + ' (AI)');
  });

  it('skips names already at the table', () => {
    const taken = [BOT_NAMES[0] + BOT_NAME_SUFFIX, 'Dave'];
    expect(pickBotName(taken, () => 0)).toBe(BOT_NAMES[1] + BOT_NAME_SUFFIX);
  });

  it('numbers a name when all are taken', () => {
    const taken = BOT_NAMES.map(n => n + BOT_NAME_SUFFIX);
    expect(pickBotName(taken, () => 0)).toBe(`${BOT_NAMES[0]} 2 (AI)`);
  });
});
