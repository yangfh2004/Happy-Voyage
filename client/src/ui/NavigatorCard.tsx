import { navigatorTitle, shipName, shipTypeName, type Locale, type Navigator, type ShipStats } from '@happy-voyage/shared';
import { getLocale, useT } from '../i18n';
import { NavigatorPortrait } from './NavigatorPortrait';

const STAT_LABELS: Record<Locale, Record<keyof ShipStats, string>> = {
  en: { maxDurability: 'durability', firepower: 'firepower', cargoCapacity: 'cargo', speed: 'speed', crewCapacity: 'crew' },
  zh: { maxDurability: '耐久', firepower: '火力', cargoCapacity: '载货', speed: '航速', crewCapacity: '船员' },
};

export function describeBonus(bonus: Partial<ShipStats>, locale: Locale = getLocale()): string {
  return (Object.entries(bonus) as [keyof ShipStats, number][]).map(([stat, value]) => locale === 'zh' ? `${STAT_LABELS.zh[stat]} +${value}` : `+${value} ${STAT_LABELS.en[stat]}`).join(locale === 'zh' ? '，' : ', ');
}

/** The selected nation's navigator and signature ship on the setup screen. */
export function NavigatorCard({ navigator, color }: { navigator: Navigator; color: number }) {
  const ship = navigator.signatureShip;
  const { t, locale } = useT();
  return (
    <div className="navigator-card" aria-live="polite">
      <NavigatorPortrait navigator={navigator.id} color={color} size={72} />
      <div>
        {locale === 'zh' ? <><strong className="cjk-name">{navigator.chineseName}</strong> <span>{navigator.name}</span></>
          : <strong>{navigator.name}</strong>}
        <div className="navigator-title">{navigatorTitle(navigator.id, locale)}</div>
        <div className="signature">
          {t('Signature ship:', '特色船只：')} <strong>{shipName(ship.name, locale)}</strong> ({shipTypeName(ship.type, locale)}) · {describeBonus(ship.bonus, locale)}
        </div>
      </div>
    </div>
  );
}
