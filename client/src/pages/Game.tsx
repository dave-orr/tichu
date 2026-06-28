import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Card as CardType, cardId, identifyCombo, canBeat, isBomb, Seat, getTeamForSeat, getPartnerSeat, canPlayWishedRankFromHand, RANK_NAMES } from '@tichu/shared';
import type { NormalCard } from '@tichu/shared';
import type { useSocket } from '../hooks/useSocket.js';
import type { useAuth } from '../hooks/useAuth.js';
import Hand from '../components/Hand.js';
import CardComponent from '../components/Card.js';
import ScoreBoard from '../components/ScoreBoard.js';
import MahJongWish from '../components/MahJongWish.js';
import DragonGiveaway from '../components/DragonGiveaway.js';
import RoundResults from '../components/RoundResults.js';
import CardsSeen from '../components/CardsSeen.js';
import GameAnnouncements, { useGameEvents } from '../components/GameAnnouncement.js';
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
    case 'single': return `Single, ${r}`;
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
  const [copiedCode, setCopiedCode] = useState(false);
  const [showTichuConfirm, setShowTichuConfirm] = useState(false);
  const [passNextPlay, setPassNextPlay] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const prevTurnRef = useRef<boolean>(false);
  const gameEvents = useGameEvents(gameState, roundResult);
  const logEntries = useEventLog(gameState, roundResult, autoSkippedSeat);
  const prevEventCountRef = useRef(0);

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
  }, [phase]);

  // Detect pending Mah Jong wish (Mah Jong played but wish not yet selected)
  const pendingWish = gameState?.phase === 'playing' && gameState.mahJongWishPending;

  // Play chime when it becomes our turn (but not while wish is pending)
  const isMyTurnNow = gameState?.phase === 'playing' && gameState?.turnIndex === gameState?.mySeat;
  useEffect(() => {
    if (isMyTurnNow && !prevTurnRef.current && !pendingWish) {
      playTurnChime();
    }
    prevTurnRef.current = !!isMyTurnNow;
  }, [isMyTurnNow, pendingWish]);

  // Urgency nudge — blue glow on action buttons after 5s, flashing after 30s
  const dragonGiveawayForMe = !!(gameState?.dragonGiveaway && gameState?.dragonGiveawayBy === gameState?.mySeat);
  const myTurnAwaitingAction = !!isMyTurnNow
    && !pendingWish
    && !needMahJongWish
    && !gameState?.bombWindow
    && !gameState?.trickCountdown
    && !dragonGiveawayForMe;
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

  // Set document title with player name
  useEffect(() => {
    if (gameState) {
      const name = gameState.players[gameState.mySeat].name;
      document.title = `Tichu — ${name}`;
    }
    return () => { document.title = 'Tichu'; };
  }, [gameState?.mySeat, gameState?.players]);

  // Flash tab title when it's your turn and tab is not focused
  useEffect(() => {
    if (!isMyTurnNow || pendingWish) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    let flash = false;
    const playerName = gameState?.players[gameState.mySeat].name ?? '';
    const baseTitle = `Tichu — ${playerName}`;

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
  }, [isMyTurnNow, pendingWish, gameState?.mySeat, gameState?.players]);

  // Derived game values, computed null-safely so the hooks that follow run
  // unconditionally (Rules of Hooks). The early return comes after them.
  const currentTrick = gameState?.currentTrick ?? null;
  const myHand = gameState?.myHand ?? [];
  const isMyTurn = gameState?.phase === 'playing' && gameState?.turnIndex === gameState?.mySeat;
  const selectedCardList = myHand.filter(c => selectedCards.has(cardId(c)));
  const mustPlayWish = gameState
    ? canPlayWishedRankFromHand(myHand, gameState.mahJongWish, currentTrick)
    : false;

  // Auto-pass when "pass next play" is queued
  useEffect(() => {
    if (passNextPlay && isMyTurn && currentTrick !== null && !mustPlayWish && !gameState?.bombWindow) {
      setPassNextPlay(false);
      socket.passTurn();
      setSelectedCards(new Set());
      setToast('Auto-passed (queued)');
      setTimeout(() => setToast(null), 2000);
    }
  }, [passNextPlay, isMyTurn, currentTrick, mustPlayWish, gameState?.bombWindow, socket]);

  // Cancel auto-pass when the trick ends (new lead)
  useEffect(() => {
    if (currentTrick === null) {
      setPassNextPlay(false);
    }
  }, [currentTrick]);

  const canPlay = useMemo(() => {
    if (!isMyTurn || selectedCardList.length === 0) return false;
    const combo = identifyCombo(selectedCardList);
    if (!combo) return false;
    if (currentTrick === null) return true; // leading
    return canBeat(currentTrick, combo);
  }, [isMyTurn, selectedCardList, currentTrick]);

  const canBombNow = useMemo(() => {
    if (phase !== 'playing' || selectedCardList.length < 4) return false;
    const combo = identifyCombo(selectedCardList);
    if (!combo || !isBomb(combo)) return false;
    if (currentTrick && !canBeat(currentTrick, combo)) return false;
    return true;
  }, [phase, selectedCardList, currentTrick]);

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

  // Cards passed to us, grouped by who they came from (relative to my seat:
  // right = +1, partner = +2, left = +3) for the incoming diamond beside the hand.
  const receivedByRel = useMemo(() => {
    const find = (rel: number) =>
      gameState.myReceivedCards.find(rc => (rc.fromSeat - mySeat + 4) % 4 === rel);
    return { partner: find(2), left: find(3), right: find(1) };
  }, [gameState.myReceivedCards, mySeat]);

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

  const partnerIsOut = phase === 'playing' && !myPlayer.isOut &&
    players[getPartnerSeat(mySeat)].isOut && !gameState.dragonGiveaway;

  const handleConcede = () => {
    socket.concede();
    setShowConcedeConfirm(false);
  };

  const handleCopyCode = () => {
    if (!socket.roomCode) return;
    navigator.clipboard?.writeText(socket.roomCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    }).catch(() => { /* clipboard unavailable — ignore */ });
  };

  const handlePlay = () => {
    if (!canPlay) return;
    socket.playCards(selectedCardList);
    setSelectedCards(new Set());
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

  // Grand Tichu phase
  if (phase === 'grandTichuWindow') {
    return (
      <GrandTichuPhase
        gameState={gameState}
        cards={myHand}
        decided={myPlayer.grandTichuDecided}
        onDecide={socket.callGrandTichu}
        gameEvents={gameEvents}
      />
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
      <PassingPhase
        gameState={gameState}
        myHand={myHand}
        mySeat={mySeat}
        playerNames={playerNames}
        hasPassed={!!myPlayer.passedCards}
        playerName={myPlayer.name}
        passRecord={passRecord}
        onPass={handlePassCards}
        gameEvents={gameEvents}
      />
    );
  }

  // One small card in a passed/received diamond beside the hand, with a full-card
  // ✕ (drawn corner-to-corner) once it's been played. The other player is
  // conveyed by position (and a hover title).
  const renderMiniCard = (card: CardType, title: string, crossWhenPlayed = true) => {
    const played = crossWhenPlayed && gameState.playedCards.some(c => cardId(c) === cardId(card));
    return (
      <div className="relative w-[39px] h-[58px]" title={title}>
        <div className="origin-top-left scale-[0.6]">
          <CardComponent card={card} small />
        </div>
        {played && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(239,68,68,0.9)" strokeWidth="3" strokeLinecap="round" />
            <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(239,68,68,0.9)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
      </div>
    );
  };

  // Main playing phase
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Score box — top left */}
      <div className="absolute top-2 left-2 z-10">
        <ScoreBoard gameState={gameState} />
      </div>

      {/* Room code + invite, tucked behind a gear so it stays unobtrusive.
          Shown to everyone so a dropped player can be replaced mid-game (by
          sharing the code or inviting) even if the organizer is the one who
          left. */}
      {socket.roomCode && (
        <div className="absolute top-2 right-2 z-20">
          <button
            onClick={() => setShowRoomMenu(v => !v)}
            title="Room & invite"
            aria-label="Room and invite options"
            className="p-2 bg-black/25 hover:bg-black/50 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {showRoomMenu && (
            <div className="absolute right-0 mt-2 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-2 min-w-[200px]">
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

      {/* Announcements overlay */}
      <GameAnnouncements events={gameEvents} />

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
      {roundResult && (
        <RoundResults
          result={roundResult}
          players={[...players]}
          onNextRound={socket.nextRound}
          isGameOver={phase === 'gameEnd'}
          mySeat={mySeat}
          roundEndReady={gameState.roundEndReady}
          roundHistory={gameState.roundHistory}
          eloUpdate={socket.eloUpdate}
        />
      )}

      {/* Table: partner (top), left/right opponents (middle), me (bottom) —
          each panel shows the player's info and their last play together so the
          whole table fits on one screen. */}
      <div className="flex-1 flex flex-col justify-center gap-2 py-2 px-2">
        {/* Top: partner */}
        <div className="flex justify-center">
          <PlayerPanel
            key={`p2-${lastPlayBySeat[relativeSeats[2]].map(cardId).join('|') || 'empty'}`}
            player={players[relativeSeats[2]]}
            isCurrentTurn={turnIndex === relativeSeats[2]}
            tichuStatus={tichuStatusFor(players[relativeSeats[2]])}
            passed={gameState.passedSeats.includes(relativeSeats[2])}
            label="Partner"
            showPoints={gameState.settings.countPoints}
            disconnected={disconnectedSeats.includes(relativeSeats[2])}
            play={lastPlayBySeat[relativeSeats[2]]}
            isTopOfTrick={lastPlayedBy === relativeSeats[2]}
            combo={currentTrick}
          />
        </div>

        {/* Middle: left opponent, center status, right opponent */}
        <div className="flex items-center justify-between gap-3">
          <PlayerPanel
            key={`p3-${lastPlayBySeat[relativeSeats[3]].map(cardId).join('|') || 'empty'}`}
            player={players[relativeSeats[3]]}
            isCurrentTurn={turnIndex === relativeSeats[3]}
            tichuStatus={tichuStatusFor(players[relativeSeats[3]])}
            passed={gameState.passedSeats.includes(relativeSeats[3])}
            showPoints={gameState.settings.countPoints}
            disconnected={disconnectedSeats.includes(relativeSeats[3])}
            play={lastPlayBySeat[relativeSeats[3]]}
            isTopOfTrick={lastPlayedBy === relativeSeats[3]}
            combo={currentTrick}
          />

          {/* Center: wish + what's on the table */}
          <div className="flex flex-col items-center justify-center gap-2 px-2 min-w-[180px] max-w-[260px] [text-shadow:0_1px_4px_rgba(0,0,0,0.85)]">
            <WishDisplay wish={gameState.mahJongWish} />
            {currentTrick && lastPlayedBy !== null ? (
              <div className="text-center">
                <div className="text-3xl uppercase tracking-wide text-gray-200 font-semibold">To beat</div>
                <div className="text-yellow-200 font-bold text-4xl">{comboLabel(currentTrick)}</div>
              </div>
            ) : (
              <div className="text-4xl text-gray-200 italic">Waiting for lead</div>
            )}
            {isMyTurn && (
              <div className="text-yellow-300 font-bold animate-pulse text-4xl">Your turn!</div>
            )}
          </div>

          <PlayerPanel
            key={`p1-${lastPlayBySeat[relativeSeats[1]].map(cardId).join('|') || 'empty'}`}
            player={players[relativeSeats[1]]}
            isCurrentTurn={turnIndex === relativeSeats[1]}
            tichuStatus={tichuStatusFor(players[relativeSeats[1]])}
            passed={gameState.passedSeats.includes(relativeSeats[1])}
            showPoints={gameState.settings.countPoints}
            disconnected={disconnectedSeats.includes(relativeSeats[1])}
            play={lastPlayBySeat[relativeSeats[1]]}
            isTopOfTrick={lastPlayedBy === relativeSeats[1]}
            combo={currentTrick}
          />
        </div>

        {/* Bottom: me */}
        <div className="flex justify-center">
          <PlayerPanel
            key={`me-${lastPlayBySeat[mySeat].map(cardId).join('|') || 'empty'}`}
            player={myPlayer}
            isCurrentTurn={isMyTurn}
            tichuStatus={tichuStatusFor(myPlayer)}
            passed={gameState.passedSeats.includes(mySeat)}
            isMe
            showPoints={gameState.settings.countPoints}
            play={lastPlayBySeat[mySeat]}
            isTopOfTrick={lastPlayedBy === mySeat}
            combo={currentTrick}
          />
        </div>
      </div>

      {/* Toast notification */}
      {(toast || autoSkippedSeat !== null) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="toast-notification bg-gray-800 text-yellow-400 px-4 py-2 rounded-lg shadow-lg text-3xl font-medium">
            {autoSkippedSeat !== null
              ? autoSkippedSeat === mySeat
                ? 'Turn skipped — not enough cards'
                : `${playerNames[autoSkippedSeat]}'s turn skipped — not enough cards`
              : toast}
          </div>
        </div>
      )}

      {/* Bottom area: player's hand and controls */}
      <div className={`p-2 bg-gray-900/50 ${isMyTurn ? 'my-turn-glow rounded-t-xl' : ''}`}>
        {/* Cards seen tracker */}
        {gameState.settings.cardsSeen && phase === 'playing' && (
          <div className="mb-1 max-w-3xl mx-auto">
            <CardsSeen myHand={myHand} playedCards={gameState.playedCards} />
          </div>
        )}

        {/* Tichu call button */}
        {!myPlayer.hasPlayedFirstCard && myPlayer.tichuCall === 'none' && phase === 'playing' && !showTichuConfirm && (
          <div className="text-center mb-2">
            <button
              onClick={() => {
                const otherCaller = players.find(p => p.seat !== mySeat && p.tichuCall !== 'none');
                if (otherCaller) {
                  setShowTichuConfirm(true);
                } else {
                  socket.callSmallTichu();
                }
              }}
              className="py-1 px-4 bg-orange-600 hover:bg-orange-500 rounded-lg text-base font-bold transition-colors"
            >
              Call Tichu!
            </button>
          </div>
        )}
        {showTichuConfirm && (
          <div className="text-center mb-2 space-y-2">
            <div className="text-3xl text-yellow-400">
              {players.filter(p => p.seat !== mySeat && p.tichuCall !== 'none').map(p =>
                `${p.name} called ${p.tichuCall === 'grand' ? 'Grand Tichu' : 'Tichu'}`
              ).join(', ')}. Still call?
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => { socket.callSmallTichu(); setShowTichuConfirm(false); }}
                className="py-1 px-4 bg-orange-600 hover:bg-orange-500 rounded-lg text-base font-bold transition-colors"
              >
                Yes, Call Tichu!
              </button>
              <button
                onClick={() => setShowTichuConfirm(false)}
                className="py-1 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-base transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          {/* Cards passed to you — a separated diamond to the LEFT of the hand,
              positioned by who passed each card (partner top, left/right below),
              mirroring the outgoing diamond on the right. */}
          {phase === 'playing' && gameState.settings.showPassedCards && gameState.myReceivedCards.length > 0 && (
            <div className="grid grid-cols-3 gap-1 shrink-0 justify-items-center items-center">
              <div className="col-start-2 row-start-1">
                {receivedByRel.partner && renderMiniCard(receivedByRel.partner.card, `Received from ${playerNames[receivedByRel.partner.fromSeat]}`, false)}
              </div>
              <div className="col-start-1 row-start-2">
                {receivedByRel.left && renderMiniCard(receivedByRel.left.card, `Received from ${playerNames[receivedByRel.left.fromSeat]}`, false)}
              </div>
              <div className="col-start-3 row-start-2">
                {receivedByRel.right && renderMiniCard(receivedByRel.right.card, `Received from ${playerNames[receivedByRel.right.fromSeat]}`, false)}
              </div>
            </div>
          )}

          <Hand
            cards={myHand}
            selectedCards={selectedCards}
            onToggleCard={toggleCard}
            disabled={phase !== 'playing'}
            large
          />

          {/* Cards you passed — a separated diamond (partner top, left/right
              below) in an auto-height grid, shorter than the hand so items-center
              keeps it vertically centered on the hand row (never below it). */}
          {phase === 'playing' && gameState.settings.showPassedCards && passRecord && (
            <div className="grid grid-cols-3 gap-1 shrink-0 justify-items-center items-center">
              <div className="col-start-2 row-start-1">{renderMiniCard(passRecord.partner.card, `Passed to ${passRecord.partner.playerName}`)}</div>
              <div className="col-start-1 row-start-2">{renderMiniCard(passRecord.left.card, `Passed to ${passRecord.left.playerName}`)}</div>
              <div className="col-start-3 row-start-2">{renderMiniCard(passRecord.right.card, `Passed to ${passRecord.right.playerName}`)}</div>
            </div>
          )}
        </div>

        {/* Bomb mode banner */}
        {gameState.bombWindow && !bombMode && (
          <div className="text-center text-3xl text-red-400 font-bold animate-pulse mb-2">
            A player is considering a bomb...
          </div>
        )}

        {/* Trick countdown */}
        {phase === 'playing' && !bombMode && gameState.trickCountdown && countdownRemaining !== null && (
          <div className="flex justify-center items-center gap-3 mt-2">
            <div className="text-2xl text-yellow-400">
              {playerNames[gameState.trickCountdown.winner]} wins trick in{' '}
              <span className="font-bold text-3xl tabular-nums">{(countdownRemaining / 1000).toFixed(1)}s</span>
            </div>
            {hasBombInHand && !gameState.bombWindow && (
              <button
                onClick={enterBombMode}
                className="py-2 px-6 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors animate-pulse"
              >
                Bomb!
              </button>
            )}
          </div>
        )}

        {/* Action buttons */}
        {phase === 'playing' && !bombMode && !gameState.trickCountdown && (
          <div
            className={`flex justify-center gap-3 mt-2 ${urgencyFlashing ? 'urgency-flash' : ''}`}
            style={urgencyGlowStyle}
          >
            {isMyTurn && !gameState.bombWindow && (
              <>
                <button
                  onClick={handlePlay}
                  disabled={!canPlay}
                  className="py-2 px-6 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
                >
                  Play
                </button>
                {currentTrick && !mustPlayWish && (
                  <button
                    onClick={handlePassTurn}
                    disabled={selectedCards.size > 0}
                    title={selectedCards.size > 0 ? 'Unselect cards to pass' : undefined}
                    className="py-2 px-6 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
                  >
                    Pass
                  </button>
                )}
                {currentTrick && mustPlayWish && gameState.mahJongWish && (
                  <div className="text-3xl text-yellow-400 flex items-center px-4">
                    You must play a {RANK_NAMES[gameState.mahJongWish]}!
                  </div>
                )}
              </>
            )}
            {!isMyTurn && !gameState.bombWindow && !myPlayer.isOut && (
              <>
                <div className="text-3xl text-gray-400">
                  Waiting for {playerNames[turnIndex]} to play...
                </div>
                {currentTrick !== null && !passNextPlay && (
                  <button
                    onClick={() => setPassNextPlay(true)}
                    className="py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-base font-medium text-gray-300 transition-colors"
                  >
                    Pass Next Turn
                  </button>
                )}
                {passNextPlay && (
                  <button
                    onClick={() => setPassNextPlay(false)}
                    className="py-2 px-4 bg-yellow-700 hover:bg-yellow-600 rounded-lg text-base font-medium text-yellow-200 transition-colors"
                  >
                    Cancel Auto-Pass
                  </button>
                )}
              </>
            )}
            {hasBombInHand && !gameState.bombWindow && (
              <button
                onClick={enterBombMode}
                disabled={currentTrick === null}
                title={currentTrick === null ? 'Wait for a card to be played' : undefined}
                className="py-2 px-6 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
              >
                Bomb!
              </button>
            )}
          </div>
        )}

        {/* Bomb selection mode */}
        {bombMode && (
          <div className="flex justify-center gap-3 mt-2">
            <div className="text-3xl text-red-400 flex items-center">Select your bomb cards</div>
            <button
              onClick={confirmBomb}
              disabled={!canBombNow}
              className="py-2 px-6 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-400 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
            >
              Confirm Bomb
            </button>
            <button
              onClick={cancelBombMode}
              className="py-2 px-6 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Concede button — visible when partner is out */}
        {partnerIsOut && !bombMode && !showConcedeConfirm && (
          <div className="flex justify-center mt-2">
            <button
              onClick={() => setShowConcedeConfirm(true)}
              className="py-1 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-base transition-colors"
            >
              Concede Round
            </button>
          </div>
        )}

        {/* Concede confirmation */}
        {showConcedeConfirm && (
          <div className="flex justify-center items-center gap-3 mt-2">
            <span className="text-3xl text-yellow-400">End the round? Your hand goes to opponents.</span>
            <button
              onClick={handleConcede}
              className="py-1 px-4 bg-red-600 hover:bg-red-500 rounded-lg text-base font-bold transition-colors"
            >
              Yes, Concede
            </button>
            <button
              onClick={() => setShowConcedeConfirm(false)}
              className="py-1 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-base transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

      </div>

      {/* Event log */}
      <EventLog entries={logEntries} />
    </div>
  );
}
