import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import GamePage from './pages/GamePage';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Score from './pages/Score';
import Premium from './pages/Premium';
import { initCloud } from './lib/cloud';

// Heavy 3D flagship (three/drei/framer-motion) — lazy so it stays out of the
// main bundle and only loads when the /labs/selector route is visited.
const Rotating3DGameSelector = lazy(() => import('./components/HolographicCardSelector'));

export default function App() {
  // Restore any cloud session and start syncing (no-op without Supabase env).
  useEffect(() => {
    void initCloud();
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/score" element={<Score />} />
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
          <Route path="/play/:id" element={<GamePage />} />
          <Route path="/play/:id/:difficulty" element={<GamePage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
