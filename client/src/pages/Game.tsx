import { useState, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Card as CardType, cardId, identifyCombo, canBeat, isBomb, Seat, getTeamForSeat, canPlayWishedRankFromHand, partnerOutBeforeThisTrick, phoenixStraightChoices, RANK_NAMES } from '@tichu/shared';
import type { NormalCard } from '@tichu/shared';
import type { useSocket } from '../hooks/useSocket.js';
import type { useAuth } from '../hooks/useAuth.js';
import Hand from '../components/Hand.js';
import CardComponent from '../components/Card.js';
import ScoreBoard from '../components/ScoreBoard.js';
import MahJongWish from '../components/MahJongWish.js';
import DragonGiveaway from '../components/DragonGiveaway.js';
import ConcedeOffer from '../components/ConcedeOffer.js';
import RoundResults from '../components/RoundResults.js';
import UserStats from '../components/UserStats.js';
import CardsSeen from '../components/CardsSeen.js';
import GameAnnouncements, { useGameEvents, seatEvents } from '../components/GameAnnouncement.js';
import PlayerPanel from '../components/PlayerPanel.js';
import InvitePanel from '../components/InvitePanel.js';
import type { TichuStatus } from '../components/TichuBadge.js';
import GrandTichuPhase from '../components/GrandTichuPhase.js';
import type { Combo, NormalRank } from '@tichu/shared';

function comboLabel(combo: Combo): string {
  const r = combo.rank in RANK_NAMES
    ? RANK_NAMES[combo.rank as NormalRank]
    : combo.rank === 1
      ? '1'
      : combo.rank === 15
        ? 'Dragon'
        : String(combo.rank);
  switch (combo.type) {
    case 'single': return combo.rank === 0 ? 'Dog' : `Single, ${r}`;
    case 'pair': return `Pair, ${r}s`;
    case 'triple': return `Triple, ${r}s`;
    case 'fullHouse': return `Full House, ${r}s`;
    case 'straight': return `${combo.length}-Straight, high ${r}`;
    case 'consecutivePairs': return `${combo.length / 2} Pairs, high ${r}`;
    case 'fourOfAKindBomb': return `4-Bomb, ${r}s`;
    case 'straightFlushBomb': return `${combo.length}-SF Bomb, high ${r}`;
  }
}
import PassingPhase from '../components/PassingPhase.js';
import type { PassRecord } from '../components/PassingPhase.js';
import EventLog, { useEventLog } from '../components/EventLog.js';
import WishDisplay from '../components/WishDisplay.js';
import { playTurnChime, playGongSound } from '../utils/sounds.js';

type Props = {
  socket: ReturnType<typeof useSocket>;
  auth: ReturnType<typeof useAuth>;
};

export default function Game({ socket, auth }: Props) {
  const { gameState, needMahJongWish, roundResult, autoSkippedSeat, disconnectedSeats } = socket;
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [passRecord, setPassRecord] = useState<PassRecord | null>(null);
  const [bombMode, setBombMode] = useState(false);
  const [showConcedeConfirm, setShowConcedeConfirm] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [exitConfirm, setExitConfirm] = useState<'leave' | 'end' | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showTichuConfirm, setShowTichuConfirm] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [passNextPlay, setPassNextPlay] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const prevTurnRef = useRef<boolean>(false);
  const gameEvents = useGameEvents(gameState, roundResult);
  const logEntries = useEventLog(gameState, roundResult, autoSkippedSeat);
  const prevEventCountRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending toast/copy timers on unmount so they can't setState after.
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  // Play gong when someone calls tichu/grand
  useEffect(() => {
    if (gameEvents.length > prevEventCountRef.current) {
      const newEvents = gameEvents.slice(prevEventCountRef.current);
      if (newEvents.some(e => e.type === 'tichu' || e.type === 'grand-tichu')) {
        playGongSound();
      }
    }
    prevEventCountRef.current = gameEvents.length;
  }, [gameEvents]);

  // Trick countdown timer — track locally from when we first see trickCountdown
  const countdownStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (!gameState?.trickCountdown) {
      setCountdownRemaining(null);
      countdownStartRef.current = null;
      return;
    }
    if (countdownStartRef.current === null) {
      countdownStartRef.current = Date.now();
    }
    const startTime = countdownStartRef.current;
    const duration = gameState.trickCountdown.durationMs ?? 3000;
    const update = () => {
      const elapsed = Date.now() - startTime;
      setCountdownRemaining(Math.max(0, duration - elapsed));
    };
    update();
    const interval = setInterval(update, 50);
    return () => clearInterval(interval);
  }, [gameState?.trickCountdown]);

  // Reset card selection when phase changes (e.g., round end -> new round)
  const phase = gameState?.phase;
  useEffect(() => {
    setSelectedCards(new Set());
    setBombMode(false);
    setPassNextPlay(false);
    // A fresh deal: last round's pass must not pre-fill this round's picks.
    if (phase === 'grandTichuWindow') setPassRecord(null);
  }, [phase]);

  // Detect pending Mah Jong wish (Mah Jong played but wish not yet selected)
  const pendingWish = gameState?.phase === 'playing' && gameState.mahJongWishPending;

  // Play chime when it becomes our turn (but not while wish is pending)
  // turnIndex stays on the last passer during the trick countdown and on the
  // giver during a Dragon giveaway, but neither is a turn anyone can act on.
  const isMyTurnNow = gameState?.phase === 'playing' && gameState?.turnIndex === gameState?.mySeat
    && !gameState?.trickCountdown && !gameState?.dragonGiveaway && !gameState?.concedeOffer;
  useEffect(() => {
    if (isMyTurnNow && !prevTurnRef.current && !pendingWish) {
      playTurnChime();
    }
    prevTurnRef.current = !!isMyTurnNow;
  }, [isMyTurnNow, pendingWish]);

  // Urgency nudge — blue glow on action buttons after 5s, flashing after 30s
  const dragonGiveawayForMe = !!(gameState?.dragonGiveaway && gameState?.dragonGiveawayBy === gameState?.mySeat);
  const myTurnAwaitingAction = (!!isMyTurnNow && !pendingWish && !needMahJongWish && !gameState?.bombWindow)
    || dragonGiveawayForMe;
  const [turnElapsedMs, setTurnElapsedMs] = useState(0);
  useEffect(() => {
    if (!myTurnAwaitingAction) {
      setTurnElapsedMs(0);
      return;
    }
    const start = Date.now();
    setTurnElapsedMs(0);
    const interval = setInterval(() => setTurnElapsedMs(Date.now() - start), 200);
    return () => clearInterval(interval);
  }, [myTurnAwaitingAction]);
  const urgencyFlashing = turnElapsedMs >= 30000;
  const urgencyT = Math.max(0, Math.min(1, (turnElapsedMs - 5000) / 25000));
  const urgencyGlowStyle: CSSProperties | undefined = urgencyT > 0 && !urgencyFlashing
    ? {
        boxShadow: `0 0 ${10 + urgencyT * 20}px ${2 + urgencyT * 4}px rgba(59, 130, 246, ${0.25 + urgencyT * 0.7}), 0 0 ${20 + urgencyT * 40}px ${4 + urgencyT * 8}px rgba(59, 130, 246, ${0.1 + urgencyT * 0.3})`,
        borderRadius: '12px',
      }
    : undefined;

  // Set document title with player name. Depend on the name string, not the
  // players array — a fresh array arrives with every broadcast and would tear
  // this (and the tab-flash effect below) down on every state update.
  const myPlayerName = gameState ? gameState.players[gameState.mySeat].name : null;
  useEffect(() => {
    if (myPlayerName) {
      document.title = `Tichu — ${myPlayerName}`;
    }
    return () => { document.title = 'Tichu'; };
  }, [myPlayerName]);

  // Flash tab title when it's your turn and tab is not focused
  useEffect(() => {
    if (!isMyTurnNow || pendingWish) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    let flash = false;
    const baseTitle = `Tichu — ${myPlayerName ?? ''}`;

    const startFlashing = () => {
      if (document.hidden) {
        interval = setInterval(() => {
          flash = !flash;
          document.title = flash ? '🔔 YOUR TURN!' : baseTitle;
        }, 800);
      }
    };

    const stopFlashing = () => {
      if (interval) { clearInterval(interval); interval = null; }
      document.title = baseTitle;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        startFlashing();
      } else {
        stopFlashing();
      }
    };

    // Start flashing if already hidden
    if (document.hidden) startFlashing();

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stopFlashing();
    };
  }, [isMyTurnNow, pendingWish, myPlayerName]);

  // Derived game values, computed null-safely so the hooks that follow run
  // unconditionally (Rules of Hooks). The early return comes after them.
  const currentTrick = gameState?.currentTrick ?? null;
  const myHand = gameState?.myHand ?? [];
  const isMyTurn = isMyTurnNow;
  const selectedCardList = myHand.filter(c => selectedCards.has(cardId(c)));
  const mustPlayWish = gameState
    ? canPlayWishedRankFromHand(myHand, gameState.mahJongWish, currentTrick)
    : false;

  // Auto-pass when "pass next play" is queued. Depends on the stable
  // socket.passTurn callback, not the socket object (rebuilt every render).
  const emitPassTurn = socket.passTurn;
  useEffect(() => {
    if (passNextPlay && isMyTurn && currentTrick !== null && !mustPlayWish && !gameState?.bombWindow) {
      setPassNextPlay(false);
      emitPassTurn();
      setSelectedCards(new Set());
      setToast('Auto-passed (queued)');
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 2000);
    }
  }, [passNextPlay, isMyTurn, currentTrick, mustPlayWish, gameState?.bombWindow, emitPassTurn]);

  // Cancel auto-pass when the trick ends (new lead)
  useEffect(() => {
    if (currentTrick === null) {
      setPassNextPlay(false);
    }
  }, [currentTrick]);

  const selectedCombo = useMemo(
    () => (selectedCardList.length > 0 ? identifyCombo(selectedCardList) : null),
    [selectedCardList],
  );

  const canPlay = useMemo(() => {
    if (!isMyTurn || !selectedCombo) return false;
    if (currentTrick !== null && !canBeat(currentTrick, selectedCombo)) return false;
    // Mirror the engine's wish rule: if we can make a legal play containing
    // the wished rank, only such a play (or a bomb) is accepted.
    if (mustPlayWish && !isBomb(selectedCombo)) {
      const wish = gameState?.mahJongWish;
      if (!selectedCombo.cards.some(c => c.type === 'normal' && c.rank === wish)) return false;
    }
    return true;
  }, [isMyTurn, selectedCombo, currentTrick, mustPlayWish, gameState?.mahJongWish]);

  // A straight the Phoenix could extend at either end (3-4-5-6 + Phoenix is
  // 2-6 or 3-7): when both readings are legal plays, Play asks which. The
  // high one beats whatever the low one does, so the low one decides.
  const phoenixChoice = useMemo(() => {
    const choice = phoenixStraightChoices(selectedCardList);
    if (!choice || (currentTrick !== null && !canBeat(currentTrick, choice.low))) return null;
    return choice;
  }, [selectedCardList, currentTrick]);
  const [showPhoenixChoice, setShowPhoenixChoice] = useState(false);
  useEffect(() => setShowPhoenixChoice(false), [selectedCardList]);

  const canBombNow = useMemo(() => {
    if (phase !== 'playing' || selectedCardList.length < 4) return false;
    // The engine refuses bombs while a wish is being chosen or a Dragon trick
    // is awaiting its giveaway.
    if (gameState?.mahJongWishPending || gameState?.dragonGiveaway) return false;
    const combo = identifyCombo(selectedCardList);
    if (!combo || !isBomb(combo)) return false;
    if (currentTrick && !canBeat(currentTrick, combo)) return false;
    return true;
  }, [phase, selectedCardList, currentTrick, gameState?.mahJongWishPending, gameState?.dragonGiveaway]);

  // Cards passed to us, grouped by who they came from (relative to my seat:
  // right = +1, partner = +2, left = +3) for the incoming diamond beside the hand.
  const myReceivedCards = gameState?.myReceivedCards;
  const mySeatForReceived = gameState?.mySeat;
  const receivedByRel = useMemo(() => {
    const find = (rel: number) =>
      myReceivedCards?.find(rc => mySeatForReceived !== undefined && (rc.fromSeat - mySeatForReceived + 4) % 4 === rel);
    return { partner: find(2), left: find(3), right: find(1) };
  }, [myReceivedCards, mySeatForReceived]);

  // Trick sweep — when the trick clears after a countdown, briefly keep
  // rendering the cleared plays while they fly toward the winner's seat,
  // instead of having them blink out. useLayoutEffect so the sweep state is
  // set before the empty-trick frame paints (no flicker).
  const [sweep, setSweep] = useState<{ plays: Record<Seat, CardType[]>; winner: Seat; combo: Combo | null } | null>(null);
  const sweepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current); }, []);
  const lastTrickRef = useRef<{ plays: { seat: Seat; cards: CardType[] }[]; combo: Combo | null; winner: Seat | null }>({ plays: [], combo: null, winner: null });
  useLayoutEffect(() => {
    if (!gameState || gameState.phase !== 'playing') {
      lastTrickRef.current = { plays: [], combo: null, winner: null };
      return;
    }
    const last = lastTrickRef.current;
    if (gameState.trickCountdown) last.winner = gameState.trickCountdown.winner;
    if (gameState.currentTrickPlays.length === 0 && last.plays.length > 0 && last.winner !== null) {
      const bySeat: Record<Seat, CardType[]> = { 0: [], 1: [], 2: [], 3: [] };
      for (const p of last.plays) bySeat[p.seat] = p.cards;
      setSweep({ plays: bySeat, winner: last.winner, combo: last.combo });
      if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);
      sweepTimerRef.current = setTimeout(() => setSweep(null), 700);
      last.winner = null;
    }
    last.plays = [...gameState.currentTrickPlays];
    last.combo = gameState.currentTrick;
  }, [gameState]);

  // Detect if player has any bomb available in hand
  const hasBombInHand = useMemo(() => {
    if (phase !== 'playing') return false;
    const normalCards = myHand.filter((c): c is NormalCard => c.type === 'normal');
    // Check four-of-a-kind
    const byRank: Record<number, number> = {};
    for (const c of normalCards) {
      byRank[c.rank] = (byRank[c.rank] || 0) + 1;
    }
    if (Object.values(byRank).some(count => count >= 4)) return true;
    // Check straight flush (5+ same suit consecutive)
    const bySuit: Record<string, number[]> = {};
    for (const c of normalCards) {
      if (!bySuit[c.suit]) bySuit[c.suit] = [];
      bySuit[c.suit].push(c.rank);
    }
    for (const ranks of Object.values(bySuit)) {
      ranks.sort((a, b) => a - b);
      let consecutive = 1;
      for (let i = 1; i < ranks.length; i++) {
        if (ranks[i] === ranks[i - 1] + 1) {
          consecutive++;
          if (consecutive >= 5) return true;
        } else {
          consecutive = 1;
        }
      }
    }
    return false;
  }, [phase, myHand]);

  if (!gameState) return null;

  const {
    phase: _, players, mySeat, currentTrickPlays,
    turnIndex, lastPlayedBy, teams,
  } = gameState;

  // Most recent play per seat for this trick (later plays overwrite earlier ones).
  const lastPlayBySeat: Record<Seat, CardType[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const play of currentTrickPlays) {
    lastPlayBySeat[play.seat] = play.cards;
  }

  const myPlayer = players[mySeat];
  const playerNames = players.map(p => p.name);

  // Screen-space anchor per relative seat position (bottom/right/top/left),
  // used to aim the trick-sweep animation from each play toward the winner.
  const SWEEP_ANCHORS: Record<number, [number, number]> = { 0: [0, 300], 1: [430, 0], 2: [0, -300], 3: [-430, 0] };
  const relOf = (seat: Seat) => (seat - mySeat + 4) % 4;
  const displayPlayFor = (seat: Seat): CardType[] =>
    lastPlayBySeat[seat].length > 0 ? lastPlayBySeat[seat] : (sweep?.plays[seat] ?? []);
  const displayComboFor = (seat: Seat): Combo | null =>
    lastPlayBySeat[seat].length > 0 ? currentTrick : (sweep?.combo ?? currentTrick);
  const sweepOffsetFor = (seat: Seat): { x: number; y: number } | null => {
    if (!sweep || lastPlayBySeat[seat].length > 0 || !sweep.plays[seat]?.length) return null;
    const [sx, sy] = SWEEP_ANCHORS[relOf(seat)];
    if (seat === sweep.winner) return { x: sx * 0.15, y: sy * 0.15 }; // drift toward own edge
    const [wx, wy] = SWEEP_ANCHORS[relOf(sweep.winner)];
    return { x: wx - sx, y: wy - sy };
  };

  // Tichu/Grand Tichu call outcome, resolved as players go out: the caller
  // "made" it by going out first (outOrder === 1); once anyone else is out
  // first, every other caller has "failed". Drives the badge check/✗.
  const someoneOutFirst = players.some(p => p.outOrder === 1);
  const tichuStatusFor = (p: typeof players[number]): TichuStatus => {
    if (p.tichuCall === 'none') return 'pending';
    if (p.outOrder === 1) return 'made';
    if (someoneOutFirst) return 'failed';
    return 'pending';
  };

  // Arrange seats relative to current player: me (bottom), right, top (partner), left
  const relativeSeats = [
    mySeat,
    ((mySeat + 1) % 4) as Seat, // right
    ((mySeat + 2) % 4) as Seat, // top (partner)
    ((mySeat + 3) % 4) as Seat, // left
  ];

  const toggleCard = (card: CardType) => {
    const id = cardId(card);
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const concedeOffer = gameState.concedeOffer ?? null;
  // Offers can't start mid-countdown or while a wish is pending (the engine
  // rejects them), so hide the button then too.
  const partnerIsOut = phase === 'playing' && !myPlayer.isOut &&
    partnerOutBeforeThisTrick(gameState, mySeat) && !gameState.dragonGiveaway &&
    !gameState.trickCountdown && !gameState.mahJongWishPending && !concedeOffer;
  const concedeOfferToMe = !!concedeOffer && phase === 'playing' && !myPlayer.isOut
    && getTeamForSeat(concedeOffer.by) !== getTeamForSeat(mySeat);

  const handleConcede = () => {
    socket.concede();
    setShowConcedeConfirm(false);
  };

  const handleCopyCode = () => {
    if (!socket.roomCode) return;
    navigator.clipboard?.writeText(socket.roomCode).then(() => {
      setCopiedCode(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedCode(false), 1500);
    }).catch(() => { /* clipboard unavailable — ignore */ });
  };

  const handlePlay = (phoenixAs?: NormalRank) => {
    if (!canPlay) return;
    if (phoenixChoice && phoenixAs === undefined) {
      setShowPhoenixChoice(true);
      return;
    }
    socket.playCards(selectedCardList, phoenixAs);
    setSelectedCards(new Set());
    setShowPhoenixChoice(false);
  };

  const enterBombMode = () => {
    setBombMode(true);
    setSelectedCards(new Set());
    socket.bombAnnounce();
  };

  const cancelBombMode = () => {
    setBombMode(false);
    setSelectedCards(new Set());
    socket.bombCancel();
  };

  const confirmBomb = () => {
    if (!canBombNow) return;
    socket.bomb(selectedCardList);
    setSelectedCards(new Set());
    setBombMode(false);
  };

  const handlePassTurn = () => {
    socket.passTurn();
    setSelectedCards(new Set());
    setPassNextPlay(false);
  };

  // Action-bar state. The bar keeps every button mounted in a fixed slot and
  // toggles disabled instead, so nothing moves or appears under the cursor.
  const inCountdown = !!gameState.trickCountdown;
  const canPlayNow = canPlay && !gameState.bombWindow && !inCountdown && !concedeOffer;
  const passQueued = !isMyTurn && passNextPlay;
  const passDisabled = myPlayer.isOut || gameState.bombWindow || inCountdown || !!concedeOffer || currentTrick === null
    || (isMyTurn && (mustPlayWish || selectedCards.size > 0));
  const passTitle = isMyTurn && selectedCards.size > 0
    ? 'Unselect cards to pass'
    : currentTrick === null
      ? 'You cannot pass a lead'
      : !isMyTurn
        ? (passQueued ? 'Auto-pass queued — click to cancel' : 'Queue an automatic pass for your next turn')
        : undefined;
  const handlePassClick = () => {
    if (isMyTurn) handlePassTurn();
    else setPassNextPlay(v => !v);
  };
  const bombDisabled = gameState.bombWindow || !!concedeOffer || (currentTrick === null && !inCountdown);
  const canCallTichu = phase === 'playing' && !myPlayer.hasPlayedFirstCard && myPlayer.tichuCall === 'none'
    && !players.some(p => p.isOut);
  const handleTichuClick = () => {
    const otherCaller = players.find(p => p.seat !== mySeat && p.tichuCall !== 'none');
    if (otherCaller) setShowTichuConfirm(true);
    else socket.callSmallTichu();
  };

  // What you've selected, and whether it plays — live feedback so the Play
  // button's disabled state is never the only signal.
  const selectedComboPreview = (() => {
    if (selectedCardList.length === 0) return null;
    if (!selectedCombo) return <span className="text-2xl text-red-300">Not a valid combo</span>;
    const label = comboLabel(selectedCombo);
    if (currentTrick === null) return <span className="text-2xl text-green-300">{label} ✓</span>;
    if (canBeat(currentTrick, selectedCombo)) {
      return <span className="text-2xl text-green-300">{label} ✓ — beats {comboLabel(currentTrick)}</span>;
    }
    return <span className="text-2xl text-amber-300">{label} — doesn't beat {comboLabel(currentTrick)}</span>;
  })();

  const statusContent = (() => {
    if (bombMode) return <span className="text-2xl text-red-400 font-bold">Select your bomb cards</span>;
    if (gameState.trickCountdown && countdownRemaining !== null) {
      const duration = gameState.trickCountdown.durationMs ?? 3000;
      return (
        <div className="min-w-[220px]">
          <div className="text-2xl text-yellow-400">{playerNames[gameState.trickCountdown.winner]} wins the trick</div>
          <div className="h-1.5 mt-1 bg-gray-700 rounded overflow-hidden">
            <div className="h-full bg-yellow-400 rounded" style={{ width: `${(countdownRemaining / duration) * 100}%` }} />
          </div>
        </div>
      );
    }
    if (concedeOffer) {
      if (concedeOffer.by === mySeat) {
        return (
          <span className="flex items-center gap-3">
            <span className="text-2xl text-yellow-400 animate-pulse">Waiting for opponents to accept your concession…</span>
            <button
              onClick={socket.withdrawConcede}
              className="shrink-0 py-1 px-3 bg-gray-600 hover:bg-gray-500 rounded-lg text-base transition-colors"
            >
              Withdraw
            </button>
          </span>
        );
      }
      return <span className="text-2xl text-yellow-400">{playerNames[concedeOffer.by]} offered to concede…</span>;
    }
    if (gameState.bombWindow) {
      return <span className="text-2xl text-red-400 font-bold animate-pulse">A player is considering a bomb…</span>;
    }
    if (selectedComboPreview) return selectedComboPreview;
    if (isMyTurn && mustPlayWish && gameState.mahJongWish) {
      return <span className="text-2xl text-yellow-400">You must play a {RANK_NAMES[gameState.mahJongWish]}!</span>;
    }
    if (myPlayer.isOut) return <span className="text-2xl text-gray-500 italic">You're out</span>;
    if (!isMyTurn) {
      return (
        <span className="text-2xl text-gray-400">
          {passQueued ? `Auto-pass queued — waiting for ${playerNames[turnIndex]}…` : `Waiting for ${playerNames[turnIndex]}…`}
        </span>
      );
    }
    return null;
  })();

  // The organizer can end the game any time; anyone can once a player has
  // dropped, so a table abandoned mid-game isn't stuck (the server enforces this).
  const canEndGame = socket.isOrganizer || disconnectedSeats.length > 0;

  // Gear menu (room code, invites, leave / end game), shown in every phase so
  // nobody is trapped in a game someone else walked away from.
  const roomMenu = (
    <>
      {/* Room code + invite, tucked behind a gear so it stays unobtrusive.
          Shown to everyone so a dropped player can be replaced mid-game (by
          sharing the code or inviting) even if the organizer is the one who
          left. */}
      {socket.roomCode && (
        <div className="absolute top-2 right-2 z-20">
          <button
            onClick={() => { setShowRoomMenu(v => !v); setExitConfirm(null); }}
            title="Room, invite & leave"
            aria-label="Room options"
            className="p-2 bg-black/20 hover:bg-black/40 text-cream/50 hover:text-cream rounded-xl transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {showRoomMenu && (
            <div className="surface !bg-gray-900/95 absolute right-0 mt-2 p-3 flex flex-col gap-2 min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Room</span>
                <span className="font-mono font-bold tracking-widest text-yellow-400 text-lg">{socket.roomCode}</span>
                <button
                  onClick={handleCopyCode}
                  title={copiedCode ? 'Copied!' : 'Copy room code'}
                  aria-label="Copy room code"
                  className="ml-auto px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors text-sm"
                >
                  {copiedCode ? '✓' : '⧉'}
                </button>
              </div>
              {auth.profile && (
                <button
                  onClick={() => { setShowInvitePanel(true); setShowRoomMenu(false); }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded font-semibold transition-colors text-sm"
                >
                  Invite players
                </button>
              )}
              {phase !== 'gameEnd' && (
                <>
                  <div className="border-t border-gray-700 my-1" />
                  {exitConfirm ? (
                    <div className="flex flex-col gap-2 max-w-[240px]">
                      <span className="text-sm text-cream">
                        {exitConfirm === 'leave'
                          ? 'Leave this game? Your seat opens up for someone else to take over with the room code; the others keep playing.'
                          : 'End this game for everyone? All players go back to the lobby and the game is not finished or rated.'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setExitConfirm(null);
                            setShowRoomMenu(false);
                            if (exitConfirm === 'leave') socket.resetRoom(); else socket.endGame();
                          }}
                          className="flex-1 px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded font-semibold transition-colors text-sm whitespace-nowrap"
                        >
                          {exitConfirm === 'leave' ? 'Leave' : 'End game'}
                        </button>
                        <button
                          onClick={() => setExitConfirm(null)}
                          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setExitConfirm('leave')}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded font-semibold transition-colors text-sm"
                      >
                        Leave game
                      </button>
                      {canEndGame && (
                        <button
                          onClick={() => setExitConfirm('end')}
                          className="px-3 py-1.5 bg-red-800 hover:bg-red-700 rounded font-semibold transition-colors text-sm"
                        >
                          End game for everyone
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {showInvitePanel && (
        <InvitePanel
          onClose={() => setShowInvitePanel(false)}
          fetchPlayers={socket.fetchPlayers}
          sendInvite={socket.sendInvite}
          expiredInviteUids={socket.expiredInviteUids}
        />
      )}
    </>
  );

  // Grand Tichu phase
  if (phase === 'grandTichuWindow') {
    return (
      <div className="h-full relative">
        {roomMenu}
        <GrandTichuPhase
          gameState={gameState}
          cards={myHand}
          decided={myPlayer.grandTichuDecided}
          onDecide={socket.callGrandTichu}
          gameEvents={gameEvents}
        />
      </div>
    );
  }

  // Card passing phase
  if (phase === 'passing') {
    const handlePassCards = (left: CardType, partner: CardType, right: CardType) => {
      const leftSeat = ((mySeat + 3) % 4) as Seat;
      const partnerSeat = ((mySeat + 2) % 4) as Seat;
      const rightSeat = ((mySeat + 1) % 4) as Seat;
      setPassRecord({
        left: { card: left, playerName: playerNames[leftSeat] },
        partner: { card: partner, playerName: playerNames[partnerSeat] },
        right: { card: right, playerName: playerNames[rightSeat] },
      });
      socket.passCards(left, partner, right);
    };

    return (
      <div className="h-full relative">
        {roomMenu}
        <PassingPhase
          gameState={gameState}
          myHand={myHand}
          mySeat={mySeat}
          playerNames={playerNames}
          hasPassed={!!myPlayer.passedCards}
          playerName={myPlayer.name}
          passRecord={passRecord}
          onPass={handlePassCards}
          onUndoPass={socket.undoPass}
          gameEvents={gameEvents}
        />
      </div>
    );
  }

  // One small card in the passed/received trio beside the hand, grayed out
  // once it's been played. The other player is conveyed by position (left
  // opponent / partner / right opponent, matching the table) and a hover
  // title. The wrapper matches the scaled card's true size (96x144 x 0.8) so
  // spacing stays honest.
  // The hand shares the bottom row with the received / passed trios (each
  // three 77px mini cards plus gaps, and a 12px gap to the hand), so it gets
  // whatever width is left of the 1300px design.
  const showReceived = phase === 'playing' && gameState.settings.showPassedCards && gameState.myReceivedCards.length > 0;
  const showPassed = phase === 'playing' && gameState.settings.showPassedCards && !!passRecord;
  const TRIO_WIDTH = 3 * 77 + 2 * 4 + 12;
  const handMaxWidth = 1300 - 16 - (showReceived ? TRIO_WIDTH : 0) - (showPassed ? TRIO_WIDTH : 0);
  // With the received trio hidden, tag the cards you were passed with who
  // sent them instead, until the round's first trick is won.
  const receivedTags = phase === 'playing' && !gameState.settings.showPassedCards
    && players.every(p => p.trickCount === 0)
    ? new Map(gameState.myReceivedCards.map(rc => [cardId(rc.card), `from ${playerNames[rc.fromSeat]}`]))
    : undefined;

  const renderMiniCard = (card: CardType, title: string, fadeWhenPlayed = true) => {
    const played = fadeWhenPlayed && gameState.playedCards.some(c => cardId(c) === cardId(card));
    return (
      <div className="relative w-[77px] h-[116px]" title={played ? `${title} — played` : title}>
        <div className={`origin-top-left scale-[0.8] transition-[filter,opacity] duration-300 ${played ? 'grayscale opacity-40' : ''}`}>
          <CardComponent card={card} />
        </div>
      </div>
    );
  };

  // Main playing phase
  return (
    <div className="h-full overflow-hidden flex flex-col relative">
      {/* Score box — top left */}
      <div className="absolute top-2 left-2 z-10">
        <ScoreBoard gameState={gameState} />
      </div>

      {/* Once the game is over, always offer a way back to the lobby — even if
          the results modal was dismissed (e.g. by a page reload, which drops the
          modal but leaves the room in its finished state). */}
      {phase === 'gameEnd' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={socket.resetRoom}
            className="btn btn-pass py-2 px-6 text-base"
          >
            Back to Lobby
          </button>
        </div>
      )}

      {roomMenu}

      {/* Announcements overlay */}
      <GameAnnouncements events={gameEvents} table />

      {/* Modals */}
      {(needMahJongWish || (gameState.mahJongWishPending && gameState.lastPlayedBy === mySeat)) && (
        <MahJongWish onWish={socket.mahJongWish} />
      )}
      {gameState.dragonGiveaway && gameState.dragonGiveawayBy === mySeat && (
        <DragonGiveaway
          mySeat={mySeat}
          players={[...players]}
          onGive={socket.giveDragonTrick}
        />
      )}
      {concedeOfferToMe && concedeOffer && (
        <ConcedeOffer
          concederName={playerNames[concedeOffer.by]}
          cardCount={players[concedeOffer.by].cardCount}
          alreadyAccepted={concedeOffer.accepted.includes(mySeat)}
          onRespond={socket.respondConcede}
        />
      )}
      {roundResult && (
        <RoundResults
          result={roundResult}
          players={[...players]}
          onNextRound={socket.nextRound}
          onPlayAgain={socket.playAgain}
          onLeave={socket.resetRoom}
          isGameOver={phase === 'gameEnd'}
          mySeat={mySeat}
          roundEndReady={gameState.roundEndReady}
          roundHistory={gameState.roundHistory}
          eloUpdate={socket.eloUpdate}
          headToHead={socket.headToHead}
          onShowStats={auth.profile ? () => setShowStatsModal(true) : undefined}
        />
      )}
      {/* Full lifetime stats, reachable from the game-over analytics panel.
          Rendered after RoundResults so it paints on top. */}
      {showStatsModal && auth.profile && (
        <UserStats
          stats={auth.profile.stats}
          myUid={auth.profile.uid}
          fetchUserStats={socket.fetchUserStats}
          fetchPartnerStats={socket.fetchPartnerStats}
          fetchTeamStats={socket.fetchTeamStats}
          fetchRecentGames={socket.fetchRecentGames}
          fetchComebackRecord={socket.fetchComebackRecord}
          fetchGameHistory={socket.fetchGameHistory}
          onClose={() => setShowStatsModal(false)}
        />
      )}

      {/* Table: partner (top), left/right opponents (middle), me (bottom) —
          each panel shows the player's info and their last play together so the
          whole table fits on one screen. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex px-2">
       <div className="m-auto w-full flex flex-col gap-2 py-2">
        {/* Top: partner */}
        <div className="flex justify-center">
          <PlayerPanel
            player={players[relativeSeats[2]]}
            isCurrentTurn={turnIndex === relativeSeats[2]}
            tichuStatus={tichuStatusFor(players[relativeSeats[2]])}
            passed={gameState.passedSeats.includes(relativeSeats[2])}
            label="Partner"
            showPoints={gameState.settings.countPoints}
            disconnected={disconnectedSeats.includes(relativeSeats[2])}
            play={displayPlayFor(relativeSeats[2])}
            isTopOfTrick={lastPlayedBy === relativeSeats[2]}
            combo={displayComboFor(relativeSeats[2])}
            sweepOffset={sweepOffsetFor(relativeSeats[2])}
            seat={relativeSeats[2]}
            announcements={seatEvents(gameEvents, relativeSeats[2])}
            bubbleSide="right"
          />
        </div>

        {/* Middle: left opponent, center status, right opponent */}
        <div className="flex items-center justify-between gap-3">
          <PlayerPanel
            player={players[relativeSeats[3]]}
            isCurrentTurn={turnIndex === relativeSeats[3]}
            tichuStatus={tichuStatusFor(players[relativeSeats[3]])}
            passed={gameState.passedSeats.includes(relativeSeats[3])}
            showPoints={gameState.settings.countPoints}
            disconnected={disconnectedSeats.includes(relativeSeats[3])}
            play={displayPlayFor(relativeSeats[3])}
            isTopOfTrick={lastPlayedBy === relativeSeats[3]}
            combo={displayComboFor(relativeSeats[3])}
            sweepOffset={sweepOffsetFor(relativeSeats[3])}
            seat={relativeSeats[3]}
            announcements={seatEvents(gameEvents, relativeSeats[3])}
            bubbleSide="above"
          />

          {/* Center: wish + what's on the table */}
          <div className="flex flex-col items-center justify-center gap-1 px-2 min-w-[180px] max-w-[260px]">
            <WishDisplay wish={gameState.mahJongWish} />
            {currentTrick && lastPlayedBy !== null ? (
              <div className="text-center">
                <div className="text-lg uppercase tracking-[0.2em] text-cream/50 font-bold">To beat</div>
                <div className="font-display text-cream/85 font-semibold text-3xl">{comboLabel(currentTrick)}</div>
              </div>
            ) : (
              <div className="font-display text-3xl text-cream/50 italic">Waiting for lead</div>
            )}
            <div
              className="text-3xl text-cream/30 select-none"
              title={gameState.settings.clockwise ? 'Play passes clockwise' : 'Play passes counterclockwise'}
              aria-hidden="true"
            >
              {gameState.settings.clockwise ? '↻' : '↺'}
            </div>
          </div>

          <PlayerPanel
            player={players[relativeSeats[1]]}
            isCurrentTurn={turnIndex === relativeSeats[1]}
            tichuStatus={tichuStatusFor(players[relativeSeats[1]])}
            passed={gameState.passedSeats.includes(relativeSeats[1])}
            showPoints={gameState.settings.countPoints}
            disconnected={disconnectedSeats.includes(relativeSeats[1])}
            play={displayPlayFor(relativeSeats[1])}
            isTopOfTrick={lastPlayedBy === relativeSeats[1]}
            combo={displayComboFor(relativeSeats[1])}
            sweepOffset={sweepOffsetFor(relativeSeats[1])}
            seat={relativeSeats[1]}
            announcements={seatEvents(gameEvents, relativeSeats[1])}
            bubbleSide="below"
            mirror
          />
        </div>

        {/* Bottom: me */}
        <div className="flex justify-center">
          <PlayerPanel
            player={myPlayer}
            isCurrentTurn={isMyTurn}
            tichuStatus={tichuStatusFor(myPlayer)}
            passed={gameState.passedSeats.includes(mySeat)}
            showPoints={gameState.settings.countPoints}
            play={displayPlayFor(mySeat)}
            isTopOfTrick={lastPlayedBy === mySeat}
            combo={displayComboFor(mySeat)}
            sweepOffset={sweepOffsetFor(mySeat)}
            seat={mySeat}
            announcements={seatEvents(gameEvents, mySeat)}
            bubbleSide="left"
          />
        </div>
       </div>
      </div>

      {/* Toast notification */}
      {(toast || autoSkippedSeat !== null || socket.concedeDeclined) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="toast-notification surface !bg-gray-900/95 text-cream px-5 py-2 text-3xl font-semibold">
            {socket.concedeDeclined
              ? socket.concedeDeclined.seat === mySeat
                ? 'You declined the concession — play on'
                : `${playerNames[socket.concedeDeclined.seat]} declined the concession — play on`
              : autoSkippedSeat !== null
              ? autoSkippedSeat === mySeat
                ? 'Turn skipped — not enough cards'
                : `${playerNames[autoSkippedSeat]}'s turn skipped — not enough cards`
              : toast}
          </div>
        </div>
      )}

      {/* Bottom area: player's hand and controls */}
      <div className={`shrink-0 p-2 bg-black/25 border-t border-cream/10 ${isMyTurn ? 'my-turn-glow rounded-t-2xl' : ''}`}>
        {/* Cards seen tracker */}
        {gameState.settings.cardsSeen && phase === 'playing' && (
          <div className="mb-1 max-w-3xl mx-auto">
            <CardsSeen myHand={myHand} playedCards={gameState.playedCards} />
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          {/* Cards passed to you — a separated diamond to the LEFT of the hand,
              positioned by who passed each card (partner top, left/right below),
              mirroring the outgoing diamond on the right. */}
          {showReceived && (
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className="text-lg text-cream/50 font-bold uppercase tracking-[0.15em]">Received</div>
              {/* A row instead of a diamond keeps the group no taller than the
                  hand, so the cards can be bigger: left opponent / partner
                  (raised, echoing the table) / right opponent. */}
              <div className="grid grid-cols-3 gap-1 items-start">
                <div>
                  {receivedByRel.left && renderMiniCard(receivedByRel.left.card, `Received from ${playerNames[receivedByRel.left.fromSeat]}`, false)}
                </div>
                <div className="-translate-y-2">
                  {receivedByRel.partner && renderMiniCard(receivedByRel.partner.card, `Received from ${playerNames[receivedByRel.partner.fromSeat]}`, false)}
                </div>
                <div>
                  {receivedByRel.right && renderMiniCard(receivedByRel.right.card, `Received from ${playerNames[receivedByRel.right.fromSeat]}`, false)}
                </div>
              </div>
            </div>
          )}

          {/* "Your turn!" floats just above the hand so it doesn't push
              the cards around when it appears. */}
          <div className="relative">
            {isMyTurn && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-10 pointer-events-none whitespace-nowrap rounded-full bg-ochre px-5 py-1 font-display font-semibold text-ink text-3xl shadow-[0_3px_0_rgb(var(--c-ochre-dark)),0_8px_18px_-6px_rgba(0,0,0,0.6)]">
                Your turn!
              </div>
            )}
            <Hand
              cards={myHand}
              selectedCards={selectedCards}
              onToggleCard={toggleCard}
              disabled={phase !== 'playing'}
              large
              maxWidth={handMaxWidth}
              tags={receivedTags}
            />
          </div>

          {/* Cards you passed — a row mirroring the received trio: left
              opponent / partner (raised) / right opponent. */}
          {showPassed && passRecord && (
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className="text-lg text-cream/50 font-bold uppercase tracking-[0.15em]">Passed</div>
              <div className="grid grid-cols-3 gap-1 items-start">
                <div>{renderMiniCard(passRecord.left.card, `Passed to ${passRecord.left.playerName}`)}</div>
                <div className="-translate-y-2">{renderMiniCard(passRecord.partner.card, `Passed to ${passRecord.partner.playerName}`)}</div>
                <div>{renderMiniCard(passRecord.right.card, `Passed to ${passRecord.right.playerName}`)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Action bar — fixed height, stable slots. Play/Pass never move or
            unmount mid-round (they disable instead), so nothing reflows or
            appears under the cursor. Status/preview text sits left of the
            buttons; secondary actions (Bomb, Call Tichu, Concede) right.
            Confirm flows render as popovers above the bar — no layout shift. */}
        {phase === 'playing' && (
          <div className="relative mt-1">
            {showPhoenixChoice && phoenixChoice && (
              <div className="surface !bg-gray-900/95 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 px-4 py-3 flex items-center gap-3 whitespace-nowrap">
                <span className="text-2xl text-cream">Play the Phoenix as</span>
                {[
                  { as: phoenixChoice.lowAs, from: phoenixChoice.lowAs, to: phoenixChoice.highAs - 1 },
                  { as: phoenixChoice.highAs, from: phoenixChoice.lowAs + 1, to: phoenixChoice.highAs },
                ].map(({ as, from, to }) => (
                  <button
                    key={as}
                    onClick={() => handlePlay(as)}
                    className="btn btn-primary shrink-0 py-1 px-4 text-base"
                  >
                    {RANK_NAMES[as]}{' '}
                    <span className="font-semibold opacity-75">({RANK_NAMES[from as NormalRank]}–{RANK_NAMES[to as NormalRank]})</span>
                  </button>
                ))}
                <button onClick={() => setShowPhoenixChoice(false)} className="btn btn-quiet shrink-0 py-1 px-4 text-base">Cancel</button>
              </div>
            )}
            {showTichuConfirm && (
              <ConfirmPopover
                message={`${players.filter(p => p.seat !== mySeat && p.tichuCall !== 'none').map(p =>
                  `${p.name} called ${p.tichuCall === 'grand' ? 'Grand Tichu' : 'Tichu'}`).join(', ')}. Still call?`}
                confirmLabel="Yes, Call Tichu!"
                confirmClass="btn-tichu"
                onConfirm={() => { socket.callSmallTichu(); setShowTichuConfirm(false); }}
                onCancel={() => setShowTichuConfirm(false)}
              />
            )}
            {showConcedeConfirm && (
              <ConfirmPopover
                message="Offer to concede? If your opponents accept, the round ends and your hand goes to them."
                confirmLabel="Offer to Concede"
                confirmClass="btn-bomb"
                onConfirm={handleConcede}
                onCancel={() => setShowConcedeConfirm(false)}
              />
            )}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 min-h-[56px]">
              {/* Status / preview — clustered toward the buttons */}
              <div className="flex justify-end text-right">{statusContent}</div>

              {/* Primary actions — fixed slots */}
              <div
                className={`flex gap-3 ${urgencyFlashing ? 'urgency-flash' : ''}`}
                style={urgencyGlowStyle}
              >
                {bombMode ? (
                  <>
                    <button
                      onClick={confirmBomb}
                      disabled={!canBombNow}
                      className="btn btn-bomb py-2 px-6"
                    >
                      Confirm Bomb
                    </button>
                    <button
                      onClick={cancelBombMode}
                      className="btn btn-quiet py-2 px-6"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handlePlay()}
                      disabled={!canPlayNow}
                      className="btn btn-play py-2 px-8"
                    >
                      Play
                    </button>
                    <button
                      onClick={handlePassClick}
                      disabled={passDisabled}
                      title={passTitle}
                      className={`btn py-2 px-8 ${passQueued ? 'btn-primary' : 'btn-pass'}`}
                    >
                      {passQueued ? 'Pass ✓' : 'Pass'}
                    </button>
                  </>
                )}
              </div>

              {/* Secondary actions */}
              <div className="flex items-center gap-2">
                {hasBombInHand && !bombMode && (
                  <button
                    onClick={enterBombMode}
                    disabled={bombDisabled}
                    title={bombDisabled ? 'Wait for a card to be played' : undefined}
                    className="btn btn-bomb py-2 px-5"
                  >
                    Bomb!
                  </button>
                )}
                {canCallTichu && !bombMode && (
                  <button
                    onClick={handleTichuClick}
                    className="btn btn-tichu py-2 px-4"
                  >
                    Call Tichu!
                  </button>
                )}
                {partnerIsOut && !bombMode && (
                  <button
                    onClick={() => setShowConcedeConfirm(true)}
                    className="btn btn-quiet py-1.5 px-3 text-base"
                  >
                    Concede
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Event log */}
      <EventLog entries={logEntries} />
    </div>
  );
}

/** Small confirm dialog floated above the action bar so it never shifts layout. */
function ConfirmPopover({ message, confirmLabel, confirmClass, onConfirm, onCancel }: {
  message: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="surface !bg-gray-900/95 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 max-w-3xl px-4 py-3 flex items-center gap-3">
      <span className="text-2xl text-cream">{message}</span>
      <button
        onClick={onConfirm}
        className={`btn shrink-0 py-1 px-4 text-base ${confirmClass}`}
      >
        {confirmLabel}
      </button>
      <button
        onClick={onCancel}
        className="btn btn-quiet shrink-0 py-1 px-4 text-base"
      >
        Cancel
      </button>
    </div>
  );
}
