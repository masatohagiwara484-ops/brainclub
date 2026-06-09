import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import Home from './pages/Home';
import GamePage from './pages/GamePage';
import OnlineGamePage from './pages/OnlineGamePage';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Score from './pages/Score';
import Leaderboard from './pages/Leaderboard';
import Premium from './pages/Premium';
import { initCloud } from './lib/cloud';

// Heavy 3D flagship (three/drei/framer-motion) — lazy so it stays out of the
// main bundle and only loads when the /labs/selector route is visited.
const Rotating3DGameSelector = lazy(() => import('./components/HolographicCardSelector'));

export default function App() {
  // The opening splash (chess.com-style). Mounted once per page load, so it
  // shows on every cold launch and dismisses itself after ~2.5s.
  const [splash, setSplash] = useState(true);

  // Restore any cloud session and start syncing (no-op without Supabase env).
  useEffect(() => {
    void initCloud();
  }, []);

  return (
    <BrowserRouter>
      {splash && <SplashScreen onDone={() => setSplash(false)} />}
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/score" element={<Score />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/labs/selector"
            element={
              <Suspense
                fallback={<div className="flex h-full items-center justify-center text-slate-400">Loading 3D…</div>}
              >
                <Rotating3DGameSelector />
              </Suspense>
            }
          />
          <Route path="/online/:id" element={<OnlineGamePage />} />
          <Route path="/play/:id" element={<GamePage />} />
          <Route path="/play/:id/:difficulty" element={<GamePage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
