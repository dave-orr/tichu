import { describe, it, expect } from 'vitest';
import {
  CHANGELOG, addedLine, changelogLine, changelogTime, splitChangelog, summarizeChangelog,
  type ChangelogEntry,
} from './changelog.js';
import { ACHIEVEMENTS } from './achievements.js';

describe('CHANGELOG data', () => {
  it('is sorted newest first with unique PR numbers', () => {
    const prs = CHANGELOG.map(e => e.pr);
    expect(new Set(prs).size).toBe(prs.length);
    expect([...prs].sort((a, b) => b - a)).toEqual(prs);
  });

  it('has a parseable merge time and a line for every entry', () => {
    for (const e of CHANGELOG) {
      expect(Number.isFinite(changelogTime(e)), `#${e.pr}`).toBe(true);
      expect(changelogLine(e).length, `#${e.pr}`).toBeGreaterThan(0);
    }
  });

  it('never names an achievement', () => {
    const names = ACHIEVEMENTS.map(a => a.name.toLowerCase());
    for (const e of CHANGELOG) {
      const text = (e.summary ?? '').toLowerCase();
      for (const n of names) expect(text, `#${e.pr} names ${n}`).not.toContain(n);
    }
  });

  it('counts every achievement that exists', () => {
    expect(summarizeChangelog(CHANGELOG).achievements).toBe(ACHIEVEMENTS.length);
  });
});

const entry = (pr: number, mergedAt: string, extra: Partial<ChangelogEntry> = {}): ChangelogEntry =>
  ({ pr, mergedAt, kind: 'improved', summary: `PR ${pr}`, ...extra });

describe('changelogTime', () => {
  it('treats a date-only value as the end of that UTC day', () => {
    expect(changelogTime(entry(1, '2026-11-14'))).toBe(Date.parse('2026-11-14T23:59:59.999Z'));
    expect(changelogTime(entry(1, '2026-11-14T10:00:00Z'))).toBe(Date.parse('2026-11-14T10:00:00Z'));
  });
});

describe('splitChangelog', () => {
  const entries = [entry(3, '2026-11-03T12:00:00Z'), entry(2, '2026-11-02'), entry(1, '2026-11-01T12:00:00Z')];

  it('puts entries merged after the last game in "since"', () => {
    const { since, earlier } = splitChangelog(entries, Date.parse('2026-11-02T08:00:00Z'));
    expect(since.map(e => e.pr)).toEqual([3, 2]);
    expect(earlier.map(e => e.pr)).toEqual([1]);
  });

  it('treats everything as earlier when there is no last game', () => {
    const { since, earlier } = splitChangelog(entries, null);
    expect(since).toEqual([]);
    expect(earlier).toHaveLength(3);
  });
});

describe('lines and totals', () => {
  it('collapses achievements and themes into counts', () => {
    expect(addedLine(0, 0)).toBeNull();
    expect(addedLine(0, 1)).toBe('Added 1 achievement');
    expect(addedLine(2, 3)).toBe('Added 2 themes and 3 achievements');
    expect(changelogLine(entry(1, '2026-11-01', { summary: undefined, achievements: 2 }))).toBe('Added 2 achievements');
    expect(changelogLine(entry(1, '2026-11-01', { themes: 1, summary: 'Now the default' }))).toBe('Added 1 theme. Now the default');
  });

  it('sums counts and lists only entries with a summary', () => {
    const s = summarizeChangelog([
      entry(3, '2026-11-03', { summary: undefined, achievements: 2 }),
      entry(2, '2026-11-02', { themes: 1, achievements: 1 }),
      entry(1, '2026-11-01'),
    ]);
    expect(s).toMatchObject({ achievements: 3, themes: 1 });
    expect(s.listed.map(e => e.pr)).toEqual([2, 1]);
  });
});
