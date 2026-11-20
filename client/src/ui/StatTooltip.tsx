import { useEffect, useId, useReducer, useRef, type ReactNode } from 'react';
import { STAT_HELP, type Stat } from '@happy-voyage/shared';
import { statTooltipState, type TooltipPosition } from './statTooltipState';

function tooltipPosition(target: HTMLButtonElement): TooltipPosition {
  const rect = target.getBoundingClientRect();
  const halfWidth = Math.min(140, (window.innerWidth - 16) / 2);
  const left = Math.max(halfWidth + 8, Math.min(window.innerWidth - halfWidth - 8, rect.left + rect.width / 2));
  const above = rect.bottom + 120 > window.innerHeight;
  return { left, top: above ? rect.top : rect.bottom, above };
}

export function StatTooltip({ stat, children }: { stat: Stat; children?: ReactNode }) {
  const id = useId();
  const { label, description } = STAT_HELP[stat];
  const trigger = useRef<HTMLButtonElement>(null);
  const wrapper = useRef<HTMLSpanElement>(null);
  const [state, dispatch] = useReducer(statTooltipState, null);
  const position = state?.position;
  const visible = state !== null;

  useEffect(() => {
    if (!visible) return;
    const dismiss = () => dispatch({ type: 'dismiss' });
    const reposition = () => {
      if (trigger.current) dispatch({ type: 'reposition', position: tooltipPosition(trigger.current) });
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) dismiss();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    reposition();
    window.addEventListener('keydown', escape, true);
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [visible]);

  return (
    <span className="stat-wrap" ref={wrapper} onPointerLeave={(event) => dispatch({ type: 'leave', pointerType: event.pointerType })}>
      <button
        ref={trigger}
        className="stat-trigger"
        type="button"
        aria-describedby={id}
        onFocus={(event) => dispatch({ type: 'engage', position: tooltipPosition(event.currentTarget) })}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') dispatch({ type: 'hover', position: tooltipPosition(event.currentTarget) });
        }}
        onClick={(event) => dispatch({ type: 'engage', position: tooltipPosition(event.currentTarget) })}
        onBlur={() => dispatch({ type: 'dismiss' })}
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
