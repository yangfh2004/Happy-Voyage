import type { GameState, Text } from '@happy-voyage/shared';
import { useT } from '../i18n';

/** The ship's log: the most recent events, newest first, in the chosen language. */
export function LogPanel({ log, state, tones }: { log: Text[]; state: GameState; tones: Map<number, 'income' | 'expense'> }) {
  const { l } = useT();
  const recent = log.slice(-6).reverse();
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
