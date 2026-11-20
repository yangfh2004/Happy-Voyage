import { SHIP_TYPES, type Navigator, type ShipStats } from '@happy-voyage/shared';
import { NavigatorPortrait } from './NavigatorPortrait';

const STAT_LABELS: Record<keyof ShipStats, string> = {
  maxDurability: 'durability', firepower: 'firepower', cargoCapacity: 'cargo', speed: 'speed', crewCapacity: 'crew',
};

export function describeBonus(bonus: Partial<ShipStats>): string {
  return (Object.entries(bonus) as [keyof ShipStats, number][]).map(([stat, value]) => `+${value} ${STAT_LABELS[stat]}`).join(', ');
}

/** The selected nation's navigator and signature ship on the setup screen. */
export function NavigatorCard({ navigator, color }: { navigator: Navigator; color: number }) {
  const ship = navigator.signatureShip;
  return (
    <div className="navigator-card" aria-live="polite">
      <NavigatorPortrait navigator={navigator.id} color={color} size={72} />
      <div>
        <strong>{navigator.name}</strong> <span className="cjk">{navigator.chineseName}</span>
        <div className="navigator-title">{navigator.title}</div>
        <div className="signature">
          Signature ship: <strong>{ship.name}</strong> ({SHIP_TYPES[ship.type].label}) · {describeBonus(ship.bonus)}
        </div>
      </div>
    </div>
  );
}
