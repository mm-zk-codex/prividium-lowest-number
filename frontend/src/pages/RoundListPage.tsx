import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SessionState } from '../App';
import { gameAbi } from '../abi';
import { GAME_ADDRESS, getReadClient } from '../config';

type RoundData = {
  id: bigint;
  name: string;
  startTime: bigint;
  endTime: bigint;
  betsPerPlayer: number;
  finishedEarly: boolean;
  finalized: boolean;
  winner: `0x${string}`;
  winningNumber: number;
  usedBets: number;
};

type FilterOption = 'All' | 'Active' | 'Upcoming' | 'Ended' | 'Finalized';
const FILTERS: FilterOption[] = ['All', 'Active', 'Upcoming', 'Ended', 'Finalized'];

export function RoundListPage({ session }: { session: SessionState }) {
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterOption>('All');
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!session.loggedIn || !session.account) {
        setRounds([]);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const readClient = getReadClient(session.account);

        const total = (await readClient.readContract({
          address: GAME_ADDRESS,
          abi: gameAbi,
          functionName: 'nextRoundId'
        })) as bigint;

        const values: RoundData[] = [];
        for (let i = 0n; i < total; i++) {
          const [name, startTime, endTime, betsPerPlayer, finishedEarly, finalized, winner, winningNumber] =
            (await readClient.readContract({
              address: GAME_ADDRESS,
              abi: gameAbi,
              functionName: 'getRoundPublic',
              args: [i]
            })) as [string, bigint, bigint, number, boolean, boolean, `0x${string}`, number];

          const usedBets = (await readClient.readContract({
            address: GAME_ADDRESS,
            abi: gameAbi,
            functionName: 'getMyUsedBets',
            args: [i]
          })) as number;

          values.push({ id: i, name, startTime, endTime, betsPerPlayer, finishedEarly, finalized, winner, winningNumber, usedBets });
        }
        setRounds(values);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rounds');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [session.loggedIn, session.account, session.refreshVersion]);

  const getStatus = (r: RoundData): 'Finalized' | 'Finished Early' | 'Upcoming' | 'Active' | 'Ended' => {
    if (r.finalized) return 'Finalized';
    if (r.finishedEarly) return 'Finished Early';
    if (now < Number(r.startTime)) return 'Upcoming';
    if (now < Number(r.endTime)) return 'Active';
    return 'Ended';
  };

  const toClock = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m ${sec.toString().padStart(2, '0')}s`;
    if (h > 0) return `${h}h ${m}m ${sec.toString().padStart(2, '0')}s`;
    return `${m}m ${sec.toString().padStart(2, '0')}s`;
  };

  const getCountdownText = (r: RoundData) => {
    const status = getStatus(r);
    if (status === 'Finalized') return 'Finalized';
    if (status === 'Finished Early') return 'Finished Early';
    if (status === 'Ended') return 'Round Ended';

    const start = Number(r.startTime);
    const end = Number(r.endTime);
    if (now < start) return `Starts in ${toClock(start - now)}`;
    return `Ends in ${toClock(end - now)}`;
  };

  const getProgress = (r: RoundData): number | null => {
    const status = getStatus(r);
    if (status === 'Finalized' || status === 'Finished Early' || status === 'Ended') return null;

    const start = Number(r.startTime);
    const end = Number(r.endTime);
    if (now < start) return 100;
    const total = end - start;
    const remaining = end - now;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  };

  const filteredRounds = useMemo(() => {
    if (filter === 'All') return rounds;
    return rounds.filter((r) => {
      const status = getStatus(r);
      if (filter === 'Active') return status === 'Active';
      if (filter === 'Upcoming') return status === 'Upcoming';
      if (filter === 'Ended') return status === 'Ended' || status === 'Finished Early';
      if (filter === 'Finalized') return status === 'Finalized';
      return true;
    });
  }, [rounds, filter, now]);

  return (
    <section className="stack">
      <div className="rounds-title">
        <h2>Rounds</h2>
      </div>

      <div className="filter-pills">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-pill ${filter === f ? 'filter-pill-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {!session.loggedIn ? (
        <div className="card">
          <p>You must log in to view your whitelist status and place bets.</p>
        </div>
      ) : null}
      {error ? <div className="card"><p style={{ color: '#fca5a5' }}>{error}</p></div> : null}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div className="spinner spinner-lg" />
          <p className="subtle" style={{ marginTop: 12 }}>Loading rounds...</p>
        </div>
      ) : null}

      {!loading && session.loggedIn && rounds.length === 0 ? (
        <article className="card fade-in">No rounds available yet.</article>
      ) : null}

      {!loading && session.loggedIn && rounds.length > 0 && filteredRounds.length === 0 ? (
        <article className="card fade-in">No rounds match the selected filter.</article>
      ) : null}

      {filteredRounds.map((r) => {
        const status = getStatus(r);
        const progress = getProgress(r);
        const countdownText = getCountdownText(r);
        const remaining = Math.max(0, r.betsPerPlayer - r.usedBets);
        const isActive = status === 'Active';
        const progressUrgent = progress !== null && progress < 20;
        const progressUpcoming = status === 'Upcoming';

        return (
          <Link
            className={`round-card-clickable ${isActive ? 'active-wrapper' : ''}`}
            to={`/round/${r.id.toString()}`}
            key={r.id.toString()}
          >
            <article className={`card fade-in ${isActive ? 'round-card-active' : ''}`}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="round-card-title">
                  {r.name} <span className="round-id">(#{r.id.toString()})</span>
                </div>
                <span className={`status-badge ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
              </div>

              <div className="countdown-overlay-bar">
                {progress !== null && (
                  <div
                    className={`countdown-overlay-fill ${progressUrgent ? 'urgent' : ''} ${progressUpcoming ? 'upcoming' : ''}`}
                    style={{ width: `${progress}%` }}
                  />
                )}
                <span className="countdown-overlay-text">{countdownText}</span>
              </div>

              {isActive && remaining > 0 && (
                <div className="bets-remaining">{remaining} bet{remaining !== 1 ? 's' : ''} remaining</div>
              )}

              {r.finalized && r.winner !== '0x0000000000000000000000000000000000000000' && (
                <p style={{ marginTop: 8, color: '#86efac', fontSize: '0.95rem' }}>
                  Winner: {r.winner.slice(0, 6)}...{r.winner.slice(-4)} @ #{r.winningNumber}
                </p>
              )}
            </article>
          </Link>
        );
      })}
    </section>
  );
}
