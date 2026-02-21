import { useEffect } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage';
import { RoundDetailPage } from './pages/RoundDetailPage';
import { RoundListPage } from './pages/RoundListPage';
import { prividium } from './config';

export function App() {
  useEffect(() => {
    const boot = async () => {
      if (!prividium.isAuthorized()) {
        await prividium.authorize({ scopes: ['wallet:required', 'network:required'] });
      }
    };
    void boot();
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Lowest Unique Number (1..256)</h1>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link to="/">Rounds</Link>
        <Link to="/admin">Admin</Link>
      </nav>
      <Routes>
        <Route path="/" element={<RoundListPage />} />
        <Route path="/round/:id" element={<RoundDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </main>
  );
}
