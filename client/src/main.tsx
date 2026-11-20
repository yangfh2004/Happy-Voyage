import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { gameController } from './game/GameController';
import { ROOM_QUERY } from './game/OnlineRoom';
import 'dialog-polyfill/dist/dialog-polyfill.css';
import './styles.css';

// Dev builds expose the controller so playtests can stage positions (e.g. a near-complete conquest).
if (import.meta.env.DEV) Object.assign(window, { gameController });
const invite = new URLSearchParams(window.location.search).get(ROOM_QUERY);
if (invite !== null) gameController.openOnline(invite);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
