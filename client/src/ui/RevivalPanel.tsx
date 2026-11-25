import { GAMEPLAY_TUNING } from '@happy-voyage/shared';
import { shipName, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { useT } from '../i18n';

export function RevivalPanel({ state }: { state: GameState }) {
  const { locale, t } = useT();
  const { fleet } = state.players[state.currentPlayer];
  const report = state.revivalReport;
  if (!report) return null;
  const { damage, restored, goldSpent } = report;
  return <section className="revival-report">
    <div className="revival-hero">
      <svg aria-hidden="true" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="32" r="27" />
        <path d="M21 35h22l-5 6H26l-5-6Zm11-17-8 13h8V18Zm4 7 4 6h-4M26 47h12" />
      </svg>
      <div>
        <h2 id="revival-title">{t('Harbor of Renewal', '复苏港湾')}</h2>
      </div>
    </div>
    <p>{t('Repairs cost {rate}g per durability point. Repairs are automatic, limited by your gold.', '每点耐久修理费为 {rate} 金币。自动修理，费用以现有金币为限。', { rate: GAMEPLAY_TUNING.economy.repairGoldPerPoint })}</p>
    <dl className="revival-tally">
      <div><dt>{t('Durability restored', '恢复耐久')}</dt><dd>{t('{restored} of {damage}', '{restored} / {damage}', { restored, damage })}</dd></div>
      <div><dt>{t('Repair fee paid', '已付修理费')}</dt><dd>{t('{goldSpent}g', '{goldSpent} 金币', { goldSpent })}</dd></div>
    </dl>
    {restored < damage && <p className="revival-note">{t('Not enough gold for a full repair. Unrepaired damage: {remaining}.', '金币不足，无法全部修复。剩余损伤：{remaining}。', { remaining: damage - restored })}</p>}
    <h3 id="revival-fleet">{t('Fleet condition', '舰队状况')}</h3>
    {fleet.length ? <ul className="revival-fleet" aria-labelledby="revival-fleet">
      {fleet.map((ship) => <li key={ship.id}>
        <strong>{shipName(ship.name, locale)}</strong>
        <meter aria-label={t('{ship} durability', '{ship}的耐久', { ship: shipName(ship.name, locale) })}
          min={0} max={ship.maxDurability} value={ship.durability} />
        <span>{ship.durability} / {ship.maxDurability}</span>
      </li>)}
    </ul> : <p className="revival-note">{t('No ships in your fleet needed repairs.', '舰队没有需要修理的船只。')}</p>}
    <button className="primary revival-continue" onClick={() => gameController.leaveRevivalIsland()}>{t('Sail on', '继续航行')}</button>
  </section>;
}
