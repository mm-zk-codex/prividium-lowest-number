import { encodeFunctionData } from 'viem';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SessionState } from '../App';
import { gameAbi } from '../abi';
import { GAME_ADDRESS, getReadClient } from '../config';
import { sendPrividiumTx } from '../prividiumTx';

type RoundTuple = [string, bigint, bigint, number, boolean, boolean, `0x${string}`, number];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const betStorageKey = (roundId: string, account: string) =>
  `bets_${GAME_ADDRESS}_${roundId}_${account.toLowerCase()}`;

function getSavedBets(roundId: string, account: string | null): number[] {
  if (!account) return [];
  try {
    const raw = localStorage.getItem(betStorageKey(roundId, account));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveBet(roundId: string, account: string, number: number) {
  const key = betStorageKey(roundId, account);
  const existing = getSavedBets(roundId, account);
  existing.push(number);
  localStorage.setItem(key, JSON.stringify(existing));
}

const formatTime = (ts: bigint) =>
  new Date(Number(ts) * 1000).toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const shortAddress = (address: `0x${string}`) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export function RoundDetailPage({ session }: { session: SessionState }) {
  const { id = '0' } = useParams();
  const roundId = BigInt(id);
  const [betNumber, setBetNumber] = useState(1);
  const [round, setRound] = useState<RoundTuple | null>(null);
  const [whitelisted, setWhitelisted] = useState(false);
  const [usedBets, setUsedBets] = useState(0);
  const [pendingState, setPendingState] = useState('');
  const [timeNow, setTimeNow] = useState(Math.floor(Date.now() / 1000));
  const [myBets, setMyBets] = useState<number[]>([]);
  const [revealedBets, setRevealedBets] = useState<Set<number>>(new Set());
  const sortedBets = useMemo(() => [...myBets].sort((a, b) => a - b), [myBets]);
  const allRevealed = useMemo(() => sortedBets.length > 0 && sortedBets.every((_, i) => revealedBets.has(i)), [sortedBets, revealedBets]);

  const load = async () => {
    if (!session.loggedIn || !session.account) {
      setRound(null);
      setWhitelisted(false);
      setUsedBets(0);
      return;
    }

    const readClient = getReadClient(session.account);

    const data = (await readClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: 'getRoundPublic',
      args: [roundId]
    })) as RoundTuple;
    setRound(data);

    const allowed = (await readClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: 'isWhitelisted',
      args: [roundId, session.account]
    })) as boolean;
    setWhitelisted(allowed);

    const used = (await readClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: 'getMyUsedBets',
      args: [roundId]
    })) as number;
    setUsedBets(used);
    setMyBets(getSavedBets(id, session.account));
  };

  useEffect(() => {
    void load();
  }, [id, session.loggedIn, session.account, session.refreshVersion]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const countdownText = useMemo(() => {
    if (!round) return '';
    const [, startTime, endTime, , finishedEarly, finalized] = round;
    const start = Number(startTime);
    const end = Number(endTime);

    if (finalized) return 'Finalized';
    if (finishedEarly || timeNow >= end) return 'Round has ended';

    const toClock = (seconds: number) => {
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const min = Math.floor((seconds % 3600) / 60);
      const sec = seconds % 60;
      if (d > 0) return `${d}d ${h}h ${min}m ${sec.toString().padStart(2, '0')}s`;
      if (h > 0) return `${h}h ${min}m ${sec.toString().padStart(2, '0')}s`;
      return `${min}m ${sec.toString().padStart(2, '0')}s`;
    };

    if (timeNow < start) return `Starts in ${toClock(Math.max(0, start - timeNow))}`;
    return `Ends in ${toClock(Math.max(0, end - timeNow))}`;
  }, [round, timeNow]);

  const statusLabel = useMemo(() => {
    if (!round) return '';
    const [, sTime, eTime, , finishedEarly, fnlzd] = round;
    if (fnlzd) return 'Finalized';
    if (finishedEarly) return 'Finished Early';
    if (timeNow < Number(sTime)) return 'Upcoming';
    if (timeNow < Number(eTime)) return 'Active';
    return 'Ended';
  }, [round, timeNow]);

  const countdownProgress = useMemo(() => {
    if (!round) return null;
    const [, sTime, eTime, , finishedEarly, fnlzd] = round;
    const start = Number(sTime);
    const end = Number(eTime);
    if (fnlzd || finishedEarly) return null;
    if (timeNow < start) return 100;
    if (timeNow >= end) return 0;
    const total = end - start;
    const remaining = end - timeNow;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  }, [round, timeNow]);

  useEffect(() => {
    if (!round) return;
    const [, startTime, endTime] = round;
    const start = Number(startTime);
    const end = Number(endTime);

    if (timeNow === start || timeNow === end) {
      void session.refreshAppState();
    }
  }, [round, timeNow, session.refreshAppState]);

  const canBet = useMemo(() => {
    if (!round || !session.loggedIn) return false;
    const [, startTime, endTime, betsPerPlayer, finishedEarly, finalized] = round;
    const active = timeNow >= Number(startTime) && timeNow < Number(endTime);
    return whitelisted && active && !finishedEarly && !finalized && usedBets < betsPerPlayer && betNumber >= 1 && betNumber <= 256;
  }, [round, timeNow, usedBets, session.loggedIn, whitelisted, betNumber]);

  const placeBet = async () => {
    if (!session.account || !session.loggedIn || !canBet) return;
    try {
      setPendingState('Submitting...');
      const data = encodeFunctionData({ abi: gameAbi, functionName: 'bet', args: [roundId, betNumber] });
      const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
      setPendingState('Waiting for confirmation...');

      const readClient = getReadClient(session.account);
      await readClient.waitForTransactionReceipt({ hash });

      saveBet(id, session.account, betNumber);
      setMyBets(getSavedBets(id, session.account));
      await session.refreshAppState();
      session.notify('Bet submitted successfully');
      setPendingState('');
    } catch (error) {
      setPendingState('');
      session.notify(error instanceof Error ? `Bet failed: ${error.message}` : 'Bet failed', 'warn');
    }
  };

  const finalize = async () => {
    if (!session.account || !session.loggedIn) return;
    try {
      setPendingState('Finalizing...');
      const data = encodeFunctionData({ abi: gameAbi, functionName: 'finalize', args: [roundId] });
      const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
      setPendingState('Waiting for confirmation...');

      const readClient = getReadClient(session.account);
      await readClient.waitForTransactionReceipt({ hash });

      await session.refreshAppState();
      session.notify('Round finalized successfully');
      setPendingState('');
    } catch (error) {
      setPendingState('');
      session.notify(error instanceof Error ? `Finalize failed: ${error.message}` : 'Finalize failed', 'warn');
    }
  };

  if (!session.loggedIn) {
    return (
      <section className="card">
        <h2>Round #{id}</h2>
        <p>You must log in to view your whitelist status and place bets.</p>
      </section>
    );
  }

  if (!round) return (
    <section className="card" style={{ textAlign: 'center', padding: '48px' }}>
      <div className="spinner spinner-lg" />
      <p className="subtle" style={{ marginTop: 12 }}>Loading round...</p>
    </section>
  );

  const [name, startTime, endTime, betsPerPlayer, finishedEarly, finalized, winner, winningNumber] = round;
  const roundEnded = finishedEarly || timeNow >= Number(endTime);
  const remaining = Math.max(0, betsPerPlayer - usedBets);

  return (
    <section className="stack">
      <Link to="/" className="back-link">&larr; Back to Rounds</Link>
      <article className="round-hero fade-in">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>
              {name} <span className="subtle" style={{ fontSize: '1rem', fontWeight: 400 }}>#{id}</span>
            </h2>
            <p className="subtle" style={{ marginTop: 4 }}>
              Lowest unique number wins. If no number is unique, there is no winner.
            </p>
          </div>
          <span className={`status-badge ${statusLabel.toLowerCase().replace(' ', '-')}`}>
            {statusLabel}
          </span>
        </div>

        <div className="countdown-display" style={{ marginTop: 20 }}>
          <span className="countdown-text">{countdownText}</span>
        </div>
        {countdownProgress !== null && (
          <div className="countdown-bar-container">
            <div
              className={`countdown-bar-fill ${countdownProgress < 20 ? 'urgent' : ''}`}
              style={{ width: `${countdownProgress}%` }}
            />
          </div>
        )}

        <div className="bet-progress" style={{ marginTop: 16 }}>
          <span>{usedBets} / {betsPerPlayer} bets used</span>
          <div className="bet-progress-bar">
            <div
              className="bet-progress-fill"
              style={{ width: `${betsPerPlayer > 0 ? (usedBets / betsPerPlayer) * 100 : 0}%` }}
            />
          </div>
          <span>{remaining} remaining</span>
        </div>
      </article>

      {myBets.length > 0 ? (
        <article className="card fade-in">
          <div className="bet-tickets-header">
            <div>
              <h3 style={{ margin: 0, display: 'inline' }}>Your Bets</h3>
              <span className="bet-tickets-hint">(stored locally in your browser, not on-chain)</span>
            </div>
            <button
              className="bet-visibility-toggle"
              onClick={() => {
                if (allRevealed) {
                  setRevealedBets(new Set());
                } else {
                  setRevealedBets(new Set(sortedBets.map((_, i) => i)));
                }
              }}
              title={allRevealed ? 'Hide all bets' : 'Reveal all bets'}
            >
              {allRevealed ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
              {allRevealed ? 'Hide all' : 'Reveal all'}
            </button>
          </div>
          <div className="bet-tickets">
            {sortedBets.map((num, i) => {
              const revealed = revealedBets.has(i);
              return (
                <button
                  className="bet-ticket"
                  key={i}
                  onClick={() => setRevealedBets((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  })}
                  title={revealed ? 'Click to hide' : 'Click to reveal'}
                >
                  <div className="bet-ticket-label">BET</div>
                  <div className="bet-ticket-number">{revealed ? num : '–'}</div>
                </button>
              );
            })}
          </div>
        </article>
      ) : null}

      {!whitelisted ? (
        <article className="banner warn fade-in">You are not eligible to participate in this round.</article>
      ) : null}

      {whitelisted && !roundEnded && !finalized ? (
        <article className="card stack fade-in">
          <h3 style={{ margin: 0 }}>Place Your Bet</h3>
          <p className="subtle">Choose a number from 1 to 256</p>

          <div className="row" style={{ gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <span className="label">Your number</span>
              <div className="bet-stepper">
                <button
                  className="bet-stepper-btn"
                  onClick={() => setBetNumber(Math.max(1, betNumber - 1))}
                  disabled={pendingState.length > 0 || betNumber <= 1}
                >
                  &minus;
                </button>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={256}
                  value={betNumber}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v >= 1 && v <= 256) setBetNumber(v);
                  }}
                  disabled={pendingState.length > 0}
                />
                <button
                  className="bet-stepper-btn"
                  onClick={() => setBetNumber(Math.min(256, betNumber + 1))}
                  disabled={pendingState.length > 0 || betNumber >= 256}
                >
                  +
                </button>
              </div>
            </div>

            <button
              className="btn-secondary"
              onClick={() => setBetNumber(Math.floor(Math.random() * 256) + 1)}
              disabled={pendingState.length > 0}
            >
              Random
            </button>

            <button
              className="btn-primary"
              disabled={!canBet || pendingState.length > 0}
              onClick={placeBet}
              style={{ padding: '12px 32px' }}
            >
              Place Bet
            </button>
          </div>

          {pendingState ? (
            <div className="pending-indicator">
              <span className="spinner" />
              {pendingState}
            </div>
          ) : null}
        </article>
      ) : null}

      {roundEnded && !finalized ? (
        <article className="card fade-in" style={{ textAlign: 'center' }}>
          <p className="subtle" style={{ marginBottom: 12 }}>
            This round has ended. Finalize to reveal the winner.
          </p>
          <button
            className="btn-primary"
            onClick={finalize}
            disabled={pendingState.length > 0}
            style={{ padding: '14px 40px', fontSize: '1rem' }}
          >
            {pendingState ? <><span className="spinner" /> Finalizing...</> : 'Finalize Round'}
          </button>
        </article>
      ) : null}

      {finalized ? (
        <article className="winner-card">
          {winner === ZERO_ADDRESS ? (
            <h2>No winner this round</h2>
          ) : winner.toLowerCase() === session.account?.toLowerCase() ? (
            <>
              <h2>Congratulations! You won!</h2>
              <p style={{ fontSize: '1.1rem', marginTop: 8 }}>Winning number: {winningNumber}</p>
            </>
          ) : (
            <>
              <h2>Winner: {shortAddress(winner)}</h2>
              <p style={{ fontSize: '1.1rem', marginTop: 8 }}>Winning number: {winningNumber}</p>
            </>
          )}
        </article>
      ) : null}
    </section>
  );
}
