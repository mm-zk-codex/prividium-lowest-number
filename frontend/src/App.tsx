import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage';
import { AuthCallbackPage } from './AuthCallbackPage';
import { RoundDetailPage } from './pages/RoundDetailPage';
import { RoundListPage } from './pages/RoundListPage';
import { chain, prividium, walletClient } from './config';
import { hasEthereumProvider } from './utils/wallet';
import './app.css';

export type AuthStage = 'logged_out' | 'connected' | 'authorized' | 'wrong_network';

export type SessionState = {
  account: `0x${string}` | null;
  loggedIn: boolean;
  stage: AuthStage;
  refreshVersion: number;
  refreshAppState: () => Promise<void>;
  notify: (message: string, kind?: 'ok' | 'warn') => void;
};

export function App() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [networkOk, setNetworkOk] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusKind, setStatusKind] = useState<'ok' | 'warn'>('ok');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [walletAvailable, setWalletAvailable] = useState(hasEthereumProvider());
  const [showWalletMissing, setShowWalletMissing] = useState(false);

  const shortAccount = useMemo(() => {
    if (!account) return null;
    return `${account.slice(0, 6)}...${account.slice(-4)}`;
  }, [account]);

  const notify = useCallback((message: string, kind: 'ok' | 'warn' = 'ok') => {
    setStatusMessage(message);
    setStatusKind(kind);
  }, []);

  const refreshSession = useCallback(async (knownAccount?: `0x${string}`) => {
    const addresses = knownAccount ? [knownAccount] : await walletClient.getAddresses().catch(() => []);
    const nextAccount = (addresses[0] as `0x${string}` | undefined) ?? null;
    const nextAuthorized = prividium.isAuthorized();
    const currentChainId = await walletClient.getChainId().catch(() => null);

    setAccount(nextAccount);
    setAuthorized(nextAuthorized);
    setNetworkOk(currentChainId === chain.id);
  }, []);

  const refreshAppState = useCallback(async () => {
    await refreshSession();
    setRefreshVersion((value) => value + 1);
  }, [refreshSession]);

  useEffect(() => {
    setWalletAvailable(hasEthereumProvider());
    void refreshSession();

    const flash = window.sessionStorage.getItem('app_flash_status');
    if (flash) {
      notify(flash);
      window.sessionStorage.removeItem('app_flash_status');
    }
  }, [refreshSession, notify]);

  const login = async () => {
    if (!hasEthereumProvider()) {
      setWalletAvailable(false);
      setShowWalletMissing(true);
      return;
    }

    if (!prividium.isAuthorized()) {
      await prividium.authorize({ scopes: ['wallet:required', 'network:required'] });
    }
    const [nextAccount] = await walletClient.requestAddresses();

    const currentChainId = await walletClient.getChainId().catch(() => null);
    if (currentChainId !== chain.id && (window as any).ethereum) {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chain.id.toString(16)}` }]
      });
    }


    await refreshSession(nextAccount);
    await refreshAppState();
    window.sessionStorage.setItem('app_flash_status', 'Logged in successfully.');
    window.location.reload();
  };

  const logout = async () => {
    prividium.unauthorize();
    if ((window as any).ethereum?.request) {
      await (window as any).ethereum
        .request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        })
        .catch(() => null);
    }
    setAccount(null);
    setAuthorized(false);
    setNetworkOk(false);
    setRefreshVersion(0);
    await refreshAppState();
    notify('Logged out.');
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
    stage,
    refreshVersion,
    refreshAppState,
    notify
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
          {shortAccount ? <span className="chip account-chip">Wallet: {shortAccount}</span> : null}
          {session.loggedIn ? (
            <button className="btn-secondary" onClick={logout}>
              Logout
            </button>
          ) : (
            <button className="btn-primary" onClick={login} disabled={!walletAvailable}>
              Login
            </button>
          )}
          {!walletAvailable ? <span className="wallet-helper">No wallet detected</span> : null}
        </div>
      </header>

      {!walletAvailable ? (
        <div className="wallet-required-card card">
          <h2>🔒 Wallet Required</h2>
          <p>This game requires a Web3 wallet to participate.</p>
          <a className="btn-primary install-link" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
            Install MetaMask
          </a>
        </div>
      ) : null}

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
      {statusMessage ? <div className={`banner ${statusKind}`}>{statusMessage}</div> : null}

      {walletAvailable ? (
        <main className="page-container">
          <Routes>
            <Route path="/" element={<RoundListPage session={session} />} />
            <Route path="/round/:id" element={<RoundDetailPage session={session} />} />
            <Route path="/admin" element={<AdminPage session={session} />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
          </Routes>
        </main>
      ) : null}

      {showWalletMissing ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="wallet-missing-title">
          <div className="modal-card">
            <h3 id="wallet-missing-title">No Web3 Wallet Detected</h3>
            <p>
              To use this application, you need a Web3 wallet like MetaMask. Install one and refresh the page.
            </p>
            <div className="row">
              <a className="btn-primary install-link" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                Install MetaMask
              </a>
              <button className="btn-secondary" onClick={() => setShowWalletMissing(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
