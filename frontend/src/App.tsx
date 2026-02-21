import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage';
import { AuthCallbackPage } from './AuthCallbackPage';
import { RoundDetailPage } from './pages/RoundDetailPage';
import { RoundListPage } from './pages/RoundListPage';
import { chain, prividium, walletClient } from './config';
import './app.css';

export type AuthStage = 'logged_out' | 'connected' | 'authorized' | 'wrong_network';

export type SessionState = {
  account: `0x${string}` | null;
  loggedIn: boolean;
  stage: AuthStage;
};

export function App() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [networkOk, setNetworkOk] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const refreshSession = useCallback(async (knownAccount?: `0x${string}`) => {
    const addresses = knownAccount ? [knownAccount] : await walletClient.getAddresses().catch(() => []);
    const nextAccount = (addresses[0] as `0x${string}` | undefined) ?? null;
    const nextAuthorized = prividium.isAuthorized();
    const currentChainId = await walletClient.getChainId().catch(() => null);

    setAccount(nextAccount);
    setAuthorized(nextAuthorized);
    setNetworkOk(currentChainId === chain.id);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = async () => {
    if (!prividium.isAuthorized()) {
      await prividium.authorize({ scopes: ['wallet:required', 'network:required'] });
    }
    const [nextAccount] = await walletClient.requestAddresses();
    await prividium.addNetworkToWallet();

    const currentChainId = await walletClient.getChainId().catch(() => null);
    if (currentChainId !== chain.id && (window as any).ethereum) {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chain.id.toString(16)}` }]
      });
    }


    await refreshSession(nextAccount);
    setStatusMessage('Logged in successfully.');
  };

  const logout = () => {
    setAccount(null);
    setAuthorized(false);
    setNetworkOk(false);
    setStatusMessage('Logged out.');
  };

  const stage = useMemo<AuthStage>(() => {
    if (!account) return 'logged_out';
    if (!networkOk) return 'wrong_network';
    if (!authorized) return 'connected';
    return 'authorized';
  }, [account, authorized, networkOk]);

  const session: SessionState = {
    account,
    loggedIn: stage === 'authorized',
    stage
  };

  const addNetwork = async () => {
    await prividium.addNetworkToWallet();
    await refreshSession();
  };

  return (
    <div className="app-shell">
      <header className="navbar">
        <div>
          <h1>Lowest Unique Number</h1>
          <p className="subtle">Private 1..256 rounds on Prividium</p>
        </div>
        <nav className="nav-links">
          <Link to="/">Rounds</Link>
          <Link to="/admin">Admin</Link>
        </nav>
        <div className="auth-box">
          <span className={`chip ${stage}`}>Status: {stage.replace('_', ' ')}</span>
          {session.loggedIn ? (
            <button className="btn-secondary" onClick={logout}>
              Logout
            </button>
          ) : (
            <button className="btn-primary" onClick={login}>
              Login
            </button>
          )}
        </div>
      </header>

      {stage === 'logged_out' ? (
        <div className="banner warn">You must log in to view your whitelist status and place bets.</div>
      ) : null}
      {stage === 'connected' ? (
        <div className="banner warn">Connected, but not logged in to Prividium. Click Login to continue.</div>
      ) : null}
      {stage === 'wrong_network' ? (
        <div className="banner warn">
          <div>Add Prividium network to your wallet / Switch network.</div>
          <button className="btn-primary" onClick={addNetwork}>
            Add Prividium network to your wallet
          </button>
        </div>
      ) : null}
      {statusMessage ? <div className="banner ok">{statusMessage}</div> : null}

      <main className="page-container">
        <Routes>
          <Route path="/" element={<RoundListPage session={session} />} />
          <Route path="/round/:id" element={<RoundDetailPage session={session} />} />
          <Route path="/admin" element={<AdminPage session={session} />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </main>
    </div>
  );
}
