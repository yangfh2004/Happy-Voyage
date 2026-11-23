import { playerRetreatThreshold, type Player, type RetreatThreshold } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { useT } from '../i18n';

export function RetreatThresholdSelector({ player }: { player: Player }) {
  const { t } = useT();
  return <label style={{ display: 'grid', gap: 6, marginBlock: 12 }}>
    {t('Auto-withdraw after losing', '损失几艘船后自动撤退')}
    <select style={{ minHeight: 44 }} value={playerRetreatThreshold(player)} onChange={e => gameController.setRetreatThreshold(e.target.value as RetreatThreshold)}>
      <option value="quarter">1/4</option>
      <option value="half">{t('Half', '半数')}</option>
      <option value="threeQuarters">3/4</option>
      <option value="last">{t('Fight to the last ship', '打到最后一艘')}</option>
    </select>
  </label>;
}
