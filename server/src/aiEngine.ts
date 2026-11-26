import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AiDecision, AiPass, ReviewAi } from '@tichu/shared';

/**
 * The Tichu AI engine (dave-orr/tichu-ai), asked for its second opinion on a
 * reviewed hand. The bot checkout sits next to this repo on the host (where
 * `scripts/deploy.sh` builds it), so the server runs its `tichu analyze`
 * once per hand: the hand's round log on stdin, the bot's choice at every
 * decision on stdout (tichu-ai's `src/analyze.rs`).
 *
 * Settings (server/.env):
 * - TICHU_AI: the tichu-ai checkout (default: `Tichu-ai` next to this repo,
 *   as in deploy.sh). The model files the bot needs are found relative to it.
 * - AI_REVIEW_BOT: the bot spec to ask (default `best`, the one at the tables).
 * - AI_REVIEW_THREADS: threads per analysis (default 2), so a review never
 *   takes every core from live games and the playing bot.
 */

// server/src or server/dist → the repo root is two up, its parent three.
const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Read lazily: this module can load before dotenv has filled process.env. */
function config() {
  const dir = path.resolve(process.env.TICHU_AI || path.join(HERE, '../../../Tichu-ai'));
  return {
    dir,
    binary: path.join(dir, 'target', 'release', process.platform === 'win32' ? 'tichu.exe' : 'tichu'),
    bot: process.env.AI_REVIEW_BOT || 'best',
    threads: String(Math.max(1, Number(process.env.AI_REVIEW_THREADS) || 2)),
  };
}
/** A whole hand with `best` takes a few seconds; anything past this is stuck. */
const TIMEOUT_MS = 120_000;
/** Analyses waiting for their turn (one runs at a time); beyond this, refuse. */
const MAX_QUEUED = 4;

let checkedAt = 0;
let available = false;
/** True when the engine binary is built on this host (re-checked every 30 s: every broadcast asks). */
export function aiEngineAvailable(): boolean {
  const now = Date.now();
  if (now - checkedAt > 30_000) {
    available = fs.existsSync(config().binary);
    checkedAt = now;
  }
  return available;
}

export function describeAiEngine(): string {
  const { binary, bot } = config();
  return fs.existsSync(binary) ? `${binary} (bot ${bot})` : `not found at ${binary} — no AI suggestions in hand reviews`;
}

type Ready = Extract<ReviewAi, { status: 'ready' }>;

let running: Promise<unknown> = Promise.resolve();
let queued = 0;

/**
 * Ask the engine about one hand (`engineRoundLog`). Runs one analysis at a
 * time; rejects with a player-facing message on any failure.
 */
export function analyzeHand(log: object): Promise<Ready> {
  if (!aiEngineAvailable()) return Promise.reject(new Error('The AI engine is not installed on this server'));
  if (queued >= MAX_QUEUED) return Promise.reject(new Error('The AI is busy with other tables, try again in a moment'));
  queued++;
  const job = running.catch(() => {}).then(() => runEngine(log)).finally(() => { queued--; });
  running = job;
  return job;
}

function runEngine(log: object): Promise<Ready> {
  return new Promise((resolve, reject) => {
    const { dir, binary, bot, threads } = config();
    const child = spawn(binary, ['analyze', '--bot', bot, '--threads', threads], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { if (err.length < 4000) err += d; });
    child.on('error', e => {
      clearTimeout(timer);
      console.error('[ai-review] could not start the engine:', e);
      reject(new Error('The AI engine could not be started'));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.error(`[ai-review] engine exited ${signal ?? code}: ${err.trim()}`);
        reject(new Error(signal ? 'The AI took too long on this hand' : 'The AI could not analyze this hand'));
        return;
      }
      try {
        resolve(parseAnalysis(JSON.parse(out)));
      } catch (e) {
        console.error('[ai-review] unreadable engine output:', e, out.slice(0, 500));
        reject(new Error('The AI could not analyze this hand'));
      }
    });
    child.stdin.on('error', () => {}); // an early exit is reported by 'close'
    child.stdin.end(JSON.stringify(log));
  });
}

/** Keep only well-formed entries of `tichu analyze`'s output. */
export function parseAnalysis(raw: unknown): Ready {
  const r = raw as { passes?: unknown; decisions?: unknown };
  if (!r || !Array.isArray(r.passes) || !Array.isArray(r.decisions)) throw new Error('missing passes/decisions');
  const seat = (s: unknown) => Number.isInteger(s) && (s as number) >= 0 && (s as number) <= 3;
  const passes = (r.passes as AiPass[]).filter(p => p && seat(p.seat) && p.left && p.partner && p.right);
  const decisions = (r.decisions as AiDecision[]).filter(d =>
    d && Number.isInteger(d.action) && seat(d.seat) && d.suggestion
    && ['play', 'pass', 'wish', 'dragon'].includes(d.suggestion.type)
    && (d.suggestion.type !== 'play' || Array.isArray(d.suggestion.cards)));
  return { status: 'ready', passes, decisions };
}
