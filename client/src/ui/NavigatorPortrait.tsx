import { getLocale } from '../i18n';
import { useId } from 'react';
import { navigatorById, navigatorName, type NavigatorId } from '@happy-voyage/shared';
import { cssColor } from './nations';

type Hat = 'beret' | 'feathered' | 'bicorne' | 'morion' | 'wusha' | 'tricorn' | 'topknot' | 'furCap' | 'cappuccio' | 'gat';
type Hair = 'long' | 'short' | 'wig' | 'none';
type Beard = 'full' | 'long' | 'goatee' | 'mustache' | 'none';

interface Look { hat: Hat; hatColor: string; hair: Hair; hairColor: string; beard: Beard; skin: string; coat: string }

/** Cartoon portrait details per navigator; the background is the nation colour. */
const LOOKS: Record<NavigatorId, Look> = {
  columbus: { hat: 'beret', hatColor: '#8e2b2b', hair: 'long', hairColor: '#d9d4c7', beard: 'none', skin: '#f3c9a0', coat: '#5b2333' },
  juliana: { hat: 'feathered', hatColor: '#e07b1a', hair: 'long', hairColor: '#f2cf63', beard: 'none', skin: '#f7d6bd', coat: '#1f4e79' },
  cook: { hat: 'bicorne', hatColor: '#15264d', hair: 'wig', hairColor: '#f1f1f1', beard: 'none', skin: '#f3c9a0', coat: '#1d3a75' },
  magellan: { hat: 'morion', hatColor: '#b8c2cc', hair: 'short', hairColor: '#2d2016', beard: 'full', skin: '#e2b48a', coat: '#3c2f2f' },
  zhengHe: { hat: 'wusha', hatColor: '#1c1c1c', hair: 'none', hairColor: '#1c1c1c', beard: 'none', skin: '#efc792', coat: '#b3282d' },
  morgan: { hat: 'tricorn', hatColor: '#1e1e1e', hair: 'long', hairColor: '#2a1a10', beard: 'goatee', skin: '#e7b98f', coat: '#9c1f2a' },
  hasekura: { hat: 'topknot', hatColor: '#1a1a1a', hair: 'none', hairColor: '#1a1a1a', beard: 'mustache', skin: '#efc792', coat: '#4b2c6b' },
  behaim: { hat: 'furCap', hatColor: '#6d4c2f', hair: 'short', hairColor: '#7a5432', beard: 'full', skin: '#f3c9a0', coat: '#3b3a36' },
  verrazzano: { hat: 'cappuccio', hatColor: '#b3282d', hair: 'short', hairColor: '#4a2f1d', beard: 'goatee', skin: '#e9bf96', coat: '#2f5d34' },
  yiSunSin: { hat: 'gat', hatColor: '#111111', hair: 'none', hairColor: '#111111', beard: 'long', skin: '#efc792', coat: '#2b4a8b' },
};

function HatShape({ hat, color }: { hat: Hat; color: string }) {
  switch (hat) {
    case 'beret':
      return <path d="M17 21 Q16 7 33 7 Q49 8 47 20 Q32 15 17 21Z" fill={color} />;
    case 'feathered':
      return (
        <>
          <ellipse cx="32" cy="18" rx="21" ry="5" fill={color} />
          <path d="M22 18 Q23 6 32 6 Q41 6 42 18Z" fill={color} />
          <path d="M40 12 Q54 2 53 16" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'bicorne':
      return <path d="M10 22 Q32 0 54 22 Q32 15 10 22Z" fill={color} stroke="#e0b728" strokeWidth="1.5" />;
    case 'morion':
      return (
        <>
          <path d="M19 19 Q32 3 45 19Z" fill={color} stroke="#7d8790" />
          <path d="M13 20 Q32 13 51 20 Q32 24 13 20Z" fill={color} stroke="#7d8790" />
          <path d="M30 6 L32 2 L34 6 L33 13 L31 13Z" fill="#7d8790" />
        </>
      );
    case 'wusha':
      return (
        <>
          <rect x="21" y="7" width="22" height="12" rx="5" fill={color} />
          <ellipse cx="13" cy="14" rx="8" ry="2.5" fill={color} />
          <ellipse cx="51" cy="14" rx="8" ry="2.5" fill={color} />
        </>
      );
    case 'tricorn':
      return <path d="M11 19 L32 5 L53 19 Q32 25 11 19Z" fill={color} stroke="#e0b728" strokeWidth="1.5" />;
    case 'topknot':
      return (
        <>
          <path d="M20 25 Q19 12 32 12 Q45 12 44 25 Q42 18 32 18 Q22 18 20 25Z" fill={color} />
          <rect x="29" y="5" width="6" height="10" rx="3" fill={color} />
        </>
      );
    case 'furCap':
      return (
        <>
          <rect x="19" y="8" width="26" height="11" rx="5" fill={color} />
          <rect x="17" y="16" width="30" height="5" rx="2.5" fill="#a07c55" />
        </>
      );
    case 'cappuccio':
      return (
        <>
          <path d="M18 21 Q15 6 32 6 Q50 6 46 21 Q32 16 18 21Z" fill={color} />
          <path d="M45 13 Q55 20 50 32" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case 'gat':
      return (
        <>
          <rect x="24" y="4" width="16" height="13" rx="2" fill={color} opacity="0.88" />
          <ellipse cx="32" cy="17" rx="24" ry="4" fill={color} opacity="0.88" />
          <path d="M22 19 L25 44 M42 19 L39 44" stroke="#6b4b2a" strokeWidth="1" />
        </>
      );
  }
}

function HairShape({ hair, color }: { hair: Hair; color: string }) {
  switch (hair) {
    case 'long':
      return <ellipse cx="32" cy="33" rx="16" ry="17" fill={color} />;
    case 'short':
      return <path d="M19 28 Q18 13 32 13 Q46 13 45 28 Q42 19 32 19 Q22 19 19 28Z" fill={color} />;
    case 'wig':
      return (
        <>
          <path d="M19 28 Q18 13 32 13 Q46 13 45 28 Q42 19 32 19 Q22 19 19 28Z" fill={color} />
          <circle cx="19" cy="30" r="4.5" fill={color} />
          <circle cx="45" cy="30" r="4.5" fill={color} />
        </>
      );
    case 'none':
      return null;
  }
}

function BeardShape({ beard, color }: { beard: Beard; color: string }) {
  const mustache = <path d="M25 37 Q32 33 39 37 Q32 35.5 25 37Z" fill={color} stroke={color} strokeWidth="1.5" />;
  switch (beard) {
    case 'full':
      return <><path d="M20 30 Q21 49 32 49 Q43 49 44 30 Q41 41 32 41 Q23 41 20 30Z" fill={color} />{mustache}</>;
    case 'long':
      return <><path d="M24 38 Q25 57 32 57 Q39 57 40 38 Q36 42 32 42 Q28 42 24 38Z" fill={color} />{mustache}</>;
    case 'goatee':
      return <><path d="M29 40 Q32 48 35 40Z" fill={color} />{mustache}</>;
    case 'mustache':
      return mustache;
    case 'none':
      return null;
  }
}

/** A navigator's portrait, drawn as SVG so it needs no asset files. */
export function NavigatorPortrait({ navigator, color, size = 48 }: { navigator: string; color: number; size?: number }) {
  const clipId = `portrait-${useId().replace(/:/g, '')}`;
  const info = navigatorById(navigator);
  const look = LOOKS[navigator as NavigatorId];
  if (!info || !look) return null;
  return (
    <svg className="portrait" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={getLocale() === 'zh' ? `${navigatorName(info.id, 'zh')}的肖像` : `${info.name} portrait`}>
      <circle cx="32" cy="32" r="31" fill={cssColor(color)} stroke="#ffda7a" strokeWidth="2" />
      <clipPath id={clipId}><circle cx="32" cy="32" r="30" /></clipPath>
      <g clipPath={`url(#${clipId})`}>
        <ellipse cx="25" cy="17" rx="28" ry="22" fill="#ffffff" opacity="0.24" />
        <HairShape hair={look.hair === 'long' ? 'long' : 'none'} color={look.hairColor} />
        <path d="M6 66 Q8 47 32 45 Q56 47 58 66Z" fill={look.coat} />
        <path d="M26 45 L32 53 L38 45Z" fill="#f5ecd7" />
        <rect x="28" y="38" width="8" height="8" fill={look.skin} />
        <ellipse cx="32" cy="30" rx="16" ry="16" fill={look.skin} />
        <HairShape hair={look.hair === 'long' ? 'short' : look.hair} color={look.hairColor} />
        <ellipse cx="25.5" cy="29" rx="4" ry="5" fill="#fffdf5" />
        <ellipse cx="38.5" cy="29" rx="4" ry="5" fill="#fffdf5" />
        <ellipse cx="26" cy="30" rx="2.8" ry="3.8" fill="#243c50" />
        <ellipse cx="38" cy="30" rx="2.8" ry="3.8" fill="#243c50" />
        <circle cx="27" cy="28" r="1.2" fill="white" />
        <circle cx="39" cy="28" r="1.2" fill="white" />
        <ellipse cx="21" cy="35" rx="3.5" ry="2" fill="#f08c86" opacity="0.6" />
        <ellipse cx="43" cy="35" rx="3.5" ry="2" fill="#f08c86" opacity="0.6" />
        <path d="M28 38 Q32 41 36 38" fill="none" stroke="#7a3b2e" strokeWidth="1.5" strokeLinecap="round" />
        {navigator === 'juliana' && <><circle cx="24" cy="34" r="2" fill="#f19c9c" opacity="0.7" /><circle cx="40" cy="34" r="2" fill="#f19c9c" opacity="0.7" /></>}
        <BeardShape beard={look.beard} color={look.hairColor} />
        <HatShape hat={look.hat} color={look.hatColor} />
      </g>
    </svg>
  );
}
