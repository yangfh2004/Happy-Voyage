/** The ship's log: the most recent events, newest first. */
export function LogPanel({ log, tones }: { log: string[]; tones: Map<number, 'income' | 'expense'> }) {
  const recent = log.slice(-6).reverse();
  return (
    <div className="panel log">
      {recent.map((line, i) => (
        <div key={log.length - i} className={[i === 0 ? 'latest' : '', tones.get(log.length - 1 - i)].filter(Boolean).join(' ')}>
          {line}
        </div>
      ))}
    </div>
  );
}
