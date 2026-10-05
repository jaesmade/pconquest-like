import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import LoadingScreen from './ui/LoadingScreen';
import { validateMoveVisuals } from './battle/moveVisuals';
import { validateMoveSounds } from './audio/audio';
import { validateCatalog } from './content/catalog';
import type { Run } from './game/types';
import { loadRun } from './persistence/save';
import './styles/base.css';
import './styles/battle.css';
import './styles/menus.css';
import './styles/route.css';
import './styles/battle-actions.css';
import './styles/theme.css';
import './styles/party-builder.css';
import './styles/battle-menu.css';
import './styles/route-overlays.css';
import './styles/route-party.css';
import './styles/deployment.css';
import './styles/pixel-system.css';

const contentErrors = [...validateCatalog(), ...validateMoveVisuals(), ...validateMoveSounds()];
function AppLoader() {
  const [initialRun, setInitialRun] = useState<Run>();
  useEffect(() => {
    let mounted = true;
    void Promise.all([
      loadRun(),
      document.fonts.load('16px "Pixelify Sans"').catch(() => []),
      document.fonts.load('8px "Press Start 2P"').catch(() => []),
    ]).then(([loaded]) => { if (mounted) setInitialRun(loaded); });
    return () => { mounted = false; };
  }, []);
  return initialRun ? <App initialRun={initialRun} /> : <LoadingScreen />;
}
createRoot(document.getElementById('root')!).render(contentErrors.length
  ? <main className="narrow"><h1>Content needs attention</h1><p>Fix these catalog references before starting a run:</p><ul>{contentErrors.map(error => <li key={error}>{error}</li>)}</ul></main>
  : <React.StrictMode><AppLoader /></React.StrictMode>);
