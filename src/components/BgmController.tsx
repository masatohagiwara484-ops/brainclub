import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../lib/settings';
import { sound } from '../lib/sound';

// Drives background music from the current route: the menus share one slow loop,
// gameplay (/play/*) gets another, crossfading on the boundary. Renders nothing.
// BGM only plays once enabled (Settings) and after the first user gesture
// (FxLayer arms audio). Pauses the audio graph while the tab is hidden.
export default function BgmController() {
  const loc = useLocation();
  const s = useSettings();
  const bgm = s.isBgm();
  const track = loc.pathname.startsWith('/play/') ? 'game' : 'menu';

  useEffect(() => {
    if (bgm) sound.playBgm(track);
  }, [bgm, track]);

  useEffect(() => {
    const onVis = () => sound.setSuspended(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return null;
}
