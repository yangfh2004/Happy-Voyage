import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { gameController } from './game/GameController';
import 'dialog-polyfill/dist/dialog-polyfill.css';
import './styles.css';

// Dev builds expose the controller so playtests can stage positions (e.g. a near-complete conquest).
if (import.meta.env.DEV) Object.assign(window, { gameController });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
