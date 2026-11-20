import { useT } from '../i18n';

export function ShortcutLegend() {
  const { t } = useT();
  return <p className="shortcuts">{t('Space/Enter: spin compass · C: claim · P/F: pay toll or fight · S/Esc: sail on · D/Esc: done building/trading · D: draw or leave the lottery · K: skip · 1/2/3: speed',
    'Space/Enter：转动罗盘 · C：占领 · P/F：缴纳过路费或开战 · S/Esc：继续航行 · D/Esc：完成建设/交易 · D：开奖或离开彩票 · K：跳过 · 1/2/3：速度')}</p>;
}
