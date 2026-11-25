import type { CSSProperties } from 'react';
import { COMPASS_SECTORS } from '@happy-voyage/shared';
import { useT } from '../i18n';

function point(angle: number, radius: number) {
  const radians = angle * Math.PI / 180;
  return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) };
}

interface CompassProps {
  spinId: number;
  result: number | null;
  multiplier?: number;
  spinning: boolean;
  duration: number;
  onSettled: () => void;
}

export function Compass({ spinId, result, multiplier = 1, spinning, duration, onSettled }: CompassProps) {
  const { t } = useT();
  let start = -COMPASS_SECTORS[0].odds * 180;
  const sectors = COMPASS_SECTORS.map(({ steps, odds }) => {
    const sector = { steps, start, center: start + odds * 180 };
    start += odds * 360;
    return sector;
  });
  const rawResult = result === null ? null : result / multiplier;
  const angle = sectors.find(({ steps }) => steps === rawResult)?.center ?? 0;
  const needleStyle = {
    transform: `rotate(${angle}deg)`,
    '--compass-stop': `${1080 + angle}deg`,
    '--compass-duration': `${duration}ms`,
  } as CSSProperties;

  return (
    <div className="compass">
      <svg viewBox="-60 -60 120 120" aria-hidden="true">
        <circle r="58" fill="#8d6e63" />
        <circle r="55" fill="#ffe082" />
        <circle r="52" fill="#fff8e1" />
        <circle r="34" fill="#e0f2f1" stroke="#8d6e63" />
        <path d="M0 -30 L6 -6 L30 0 L6 6 L0 30 L-6 6 L-30 0 L-6 -6 Z" fill="#b5d6d5" />
        {sectors.map(({ steps, start, center }) => {
          const inner = point(start, 34);
          const outer = point(start, 52);
          const label = point(center, steps === 12 ? 46 : 42);
          const selected = !spinning && steps === rawResult;
          return (
            <g key={steps}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#8d6e63" />
              {selected && <circle cx={label.x} cy={label.y} r="7" fill="#0a3d62" />}
              <text x={label.x} y={label.y} dy=".35em" textAnchor="middle" fill={selected ? '#fff' : '#0a3d62'}>
                {steps}
              </text>
            </g>
          );
        })}
        <g key={spinId} className={spinning ? 'compass-needle is-spinning' : 'compass-needle'} style={needleStyle} onAnimationEnd={onSettled}>
          <path d="M0 -35 L6 0 L0 25 L-6 0 Z" fill="#0a3d62" />
          <path d="M0 -35 L6 0 L-6 0 Z" fill="#c24127" />
          <circle r="3.5" fill="#ffe082" />
        </g>
      </svg>
      <span role="status">{spinning ? t('Spinning…', '转动中…') : result === null ? t('Compass ready', '罗盘就绪') : t('{n} steps', '{n} 步', { n: result })}</span>
    </div>
  );
}
