/** The ship's log: the most recent events, newest first. */
export function LogPanel({ log }: { log: string[] }) {
  const recent = log.slice(-6).reverse();
  return (
    <div className="panel log">
      {recent.map((line, i) => (
        <div key={log.length - i} className={i === 0 ? 'latest' : undefined}>
          {line}
        </div>
      ))}
    </div>
  );
}
