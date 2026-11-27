import type { GameState, Text } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { MenuDialog } from './MenuDialog';

type LogProps = { log: Text[]; state: GameState; tones: Map<number, 'income' | 'expense'> };

/** The ship's log: newest first, in the chosen language. */
export function LogPanel({ log, state, tones, limit }: LogProps & { limit?: number }) {
  const { l } = useT();
  const recent = log.slice(limit === undefined ? 0 : -limit).reverse();
  return (
    <div className="panel log">
      {recent.map((line, i) => (
        <div key={log.length - i} className={[i === 0 ? 'latest' : '', tones.get(log.length - 1 - i)].filter(Boolean).join(' ')}>
          {l(line, state)}
        </div>
      ))}
    </div>
  );
}

export function VoyageLogButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  return <button type="button" className="voyage-log-button" aria-haspopup="dialog" onClick={onOpen}>{t('Voyage log', '航海日志')}</button>;
}

export function VoyageLogHistory({ onDismiss, ...log }: LogProps & { onDismiss: () => void }) {
  const { t } = useT();
  return (
    <MenuDialog className="panel voyage-log-history" labelledBy="voyage-log-title" onDismiss={onDismiss}>
      <header>
        <h2 id="voyage-log-title">{t('Voyage log', '航海日志')}</h2>
        <button type="button" onClick={onDismiss}>{t('Close', '关闭')}</button>
      </header>
      <div className="voyage-log-scroll" tabIndex={0}><LogPanel {...log} /></div>
    </MenuDialog>
  );
}
