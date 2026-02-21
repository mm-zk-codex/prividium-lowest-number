import { encodeFunctionData } from 'viem';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { gameAbi } from '../abi';
import { GAME_ADDRESS, readClient, walletClient } from '../config';
import { sendPrividiumTx } from '../prividiumTx';

export function RoundDetailPage() {
  const { id = '0' } = useParams();
  const roundId = BigInt(id);
  const [number, setNumber] = useState(1);
  const [localBetsUsed, setLocalBetsUsed] = useState(0);
  const [status, setStatus] = useState('');
  const [round, setRound] = useState<any>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [whitelisted, setWhitelisted] = useState(false);
  const now = Math.floor(Date.now() / 1000);

  const load = async () => {
    const data = await readClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: 'getRoundPublic',
      args: [roundId]
    });
    setRound(data);

    const [addr] = await walletClient.requestAddresses();
    setAccount(addr);
    const allowed = (await readClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: 'isWhitelisted',
      args: [roundId, addr]
    })) as boolean;
    setWhitelisted(allowed);
  };

  useEffect(() => {
    void load();
  }, [id]);

  const canBet = useMemo(() => {
    if (!round || !account) return false;
    const [startTime, endTime, betsPerPlayer, finishedEarly, finalized] = round as [bigint, bigint, number, boolean, boolean];
    const active = now >= Number(startTime) && now < Number(endTime);
    return whitelisted && active && !finishedEarly && !finalized && localBetsUsed < betsPerPlayer;
  }, [round, now, localBetsUsed, account, whitelisted]);

  const placeBet = async () => {
    if (!account) return;
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'bet', args: [roundId, number] });
    const hash = await sendPrividiumTx({ account, to: GAME_ADDRESS, data });
    setStatus(`Bet submitted: ${hash}`);
    setLocalBetsUsed((v) => v + 1);
  };

  const finalize = async () => {
    if (!account) return;
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'finalize', args: [roundId] });
    const hash = await sendPrividiumTx({ account, to: GAME_ADDRESS, data });
    setStatus(`Finalize submitted: ${hash}`);
  };

  if (!round) return <p>Loading...</p>;
  const [startTime, endTime, betsPerPlayer, finishedEarly, finalized, winner, winningNumber] = round as [
    bigint,
    bigint,
    number,
    boolean,
    boolean,
    string,
    number
  ];

  const showFinalize = now >= Number(endTime) || finishedEarly;

  return (
    <section>
      <h2>Round {id}</h2>
      <p>Start: {Number(startTime)} End: {Number(endTime)}</p>
      <p>{whitelisted ? 'Whitelisted' : 'Not whitelisted'}</p>
      <p>You have {betsPerPlayer} bets per round (PoC local remaining: {betsPerPlayer - localBetsUsed})</p>
      <div>
        <input type="number" min={1} max={256} value={number} onChange={(e) => setNumber(Number(e.target.value))} />
        <button disabled={!canBet} onClick={placeBet}>
          Bet
        </button>
      </div>
      {showFinalize && !finalized ? <button onClick={finalize}>Finalize</button> : null}
      {finalized ? <p>{winner === '0x0000000000000000000000000000000000000000' ? 'No winner' : `Winner ${winner} with ${winningNumber}`}</p> : null}
      <p>{status}</p>
    </section>
  );
}
