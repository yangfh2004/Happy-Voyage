import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { Nation } from './nations';
import type { ShipStats, ShipType } from './types';

export interface SignatureShip {
  name: string;
  type: ShipType;
  /** Added to the ship type's base stats. */
  bonus: Partial<ShipStats>;
}

export interface Navigator {
  id: string;
  name: string;
  chineseName: string;
  nation: Nation;
  title: string;
  signatureShip: SignatureShip;
}

/** One historical navigator per nation, each sailing a signature flagship (原作：哥伦布、优莉安娜、库克、摩根、麦哲伦、郑和…). */
export const NAVIGATORS = [
  { id: 'columbus', name: 'Columbus', chineseName: '哥伦布', nation: 'Spain', title: 'Admiral of the Ocean Sea',
    signatureShip: { name: 'Santa María', type: 'cargo', bonus: GAMEPLAY_TUNING.flagshipBonuses.columbus } },
  { id: 'juliana', name: 'Juliana', chineseName: '优莉安娜', nation: 'Netherlands', title: 'Merchant of Amsterdam',
    signatureShip: { name: 'Halve Maen', type: 'cargo', bonus: GAMEPLAY_TUNING.flagshipBonuses.juliana } },
  { id: 'cook', name: 'Cook', chineseName: '库克', nation: 'England', title: 'Captain of the Royal Navy',
    signatureShip: { name: 'Endeavour', type: 'explorer', bonus: GAMEPLAY_TUNING.flagshipBonuses.cook } },
  { id: 'magellan', name: 'Magellan', chineseName: '麦哲伦', nation: 'Portugal', title: 'First to Circle the Globe',
    signatureShip: { name: 'Victoria', type: 'explorer', bonus: GAMEPLAY_TUNING.flagshipBonuses.magellan } },
  { id: 'zhengHe', name: 'Zheng He', chineseName: '郑和', nation: 'China', title: 'Admiral of the Treasure Fleet',
    signatureShip: { name: 'Treasure Ship', type: 'cargo', bonus: GAMEPLAY_TUNING.flagshipBonuses.zhengHe } },
  { id: 'morgan', name: 'Morgan', chineseName: '摩根', nation: 'France', title: 'Terror of the Caribbean',
    signatureShip: { name: 'Satisfaction', type: 'warship', bonus: GAMEPLAY_TUNING.flagshipBonuses.morgan } },
  { id: 'hasekura', name: 'Hasekura', chineseName: '支仓常长', nation: 'Japan', title: 'Envoy Across the Pacific',
    signatureShip: { name: 'San Juan Bautista', type: 'warship', bonus: GAMEPLAY_TUNING.flagshipBonuses.hasekura } },
  { id: 'behaim', name: 'Behaim', chineseName: '贝海姆', nation: 'Germany', title: 'Maker of the First Globe',
    signatureShip: { name: 'Adler von Lübeck', type: 'warship', bonus: GAMEPLAY_TUNING.flagshipBonuses.behaim } },
  { id: 'verrazzano', name: 'Verrazzano', chineseName: '韦拉扎诺', nation: 'Italy', title: 'Explorer of the New World Coast',
    signatureShip: { name: 'La Dauphine', type: 'explorer', bonus: GAMEPLAY_TUNING.flagshipBonuses.verrazzano } },
  { id: 'yiSunSin', name: 'Yi Sun-sin', chineseName: '李舜臣', nation: 'Korea', title: 'Admiral of the Turtle Ships',
    signatureShip: { name: 'Turtle Ship', type: 'warship', bonus: GAMEPLAY_TUNING.flagshipBonuses.yiSunSin } },
] as const satisfies readonly Navigator[];

export type NavigatorId = (typeof NAVIGATORS)[number]['id'];

export function navigatorById(id: string): Navigator | undefined {
  return NAVIGATORS.find((navigator) => navigator.id === id);
}

export function navigatorForNation(nation: string): Navigator | undefined {
  return NAVIGATORS.find((navigator) => navigator.nation === nation);
}
