import { useEffect, useId, useState, type ReactNode } from 'react';
import { STAT_HELP, type Stat } from '@happy-voyage/shared';

export function StatTooltip({ stat, children }: { stat: Stat; children?: ReactNode }) {
  const id = useId();
  const { label, description } = STAT_HELP[stat];
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const visible = position !== null;

  useEffect(() => {
    if (!visible) return;
    const hide = () => setPosition(null);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      hide();
    };
    window.addEventListener('keydown', escape, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [visible]);

  function show(target: HTMLButtonElement) {
    const rect = target.getBoundingClientRect();
    const halfWidth = Math.min(140, (window.innerWidth - 16) / 2);
    const left = Math.max(halfWidth + 8, Math.min(window.innerWidth - halfWidth - 8, rect.left + rect.width / 2));
    const above = rect.bottom + 120 > window.innerHeight;
    setPosition({ left, top: above ? rect.top : rect.bottom, above });
  }

  return (
    <span className="stat-wrap" onMouseLeave={() => setPosition(null)}>
      <button
        className="stat-trigger"
        type="button"
        aria-describedby={id}
        onFocus={(event) => show(event.currentTarget)}
        onMouseEnter={(event) => show(event.currentTarget)}
        onClick={(event) => show(event.currentTarget)}
        onBlur={() => setPosition(null)}
      >{children ?? label}</button>
      <span
        id={id}
        role="tooltip"
        hidden={!position}
        className={position?.above ? 'stat-tooltip above' : 'stat-tooltip'}
        style={position ? { left: position.left, top: position.top } : undefined}
      ><strong>{label}</strong>{description}</span>
    </span>
  );
}
