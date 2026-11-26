import { useT } from '../i18n';

export function ShortcutLegend() {
  const { t } = useT();
  return <p className="shortcuts">{t('Space/Enter: spin compass · P/F: pay toll or fight · S/Esc: sail on · D/Esc: done building/trading · D: draw or leave the lottery · V: fleet · K: skip · 1/2/3: speed · M: sound',
    'Space/Enter：转动罗盘 · P/F：缴纳过路费或开战 · S/Esc：继续航行 · D/Esc：完成建设/交易 · D：开奖或离开彩票 · V：舰队 · K：跳过 · 1/2/3：速度 · M：声音')}</p>;
}
