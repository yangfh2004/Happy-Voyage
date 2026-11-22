export const SEA_RULES = {
  encounterChance: 0.2, merchantDiscount: 0.8, merchantReserve: 500,
  encounterWeights: { pirates: 18, smallMonster: 16, whirlpool: 12, bottle: 14, floatingCargo: 14, merchant: 14, wyvern: 4, largeMonster: 4, turtle: 4 },
  foreignTax: 40,
  nimStones: 12, nimPrize: 130,
  barterPerColony: 25, pirates: 80,
  pirateLoot: 140, pirateDurability: 90, pirateFirepower: 24,
  smallMonster: 30, largeMonster: 110, smallMonsterDamage: 12, largeMonsterDamage: 55,
  monsterSinkChance: 0.35, turtleDamage: 70,
  whirlpoolLoss: 60, whirlpoolSteps: 4, whirlpoolDamageChance: 0.33, relocationLimit: 4,
  bottle: 70, bottlePrize: 600, bottlePrizeChance: 0.1, bottleRepairChance: 0.3,
  floatingCargo: 100, cargoGoldChance: 0.5, cargoUnits: 4, merchantPremium: 1.5, merchantUnits: 5,
} as const;
