export const TUTORIAL_STEPS = [
  { title: 'Spin the compass', text: 'On your turn, select Spin compass (or press Space or Enter). The result tells your fleet how many stops to sail. What you can do next depends on where you land.' },
  { title: 'Claim and build colonies', text: 'Spend gold to claim an uncharted island. Rivals who land there must pay you a toll or fight. At your own colony, build facilities to produce goods, repair ships or expand your fleet.' },
  { title: 'Manage your fleet', text: 'Open Fleet to inspect your ships, cargo and captains. Trade goods at special islands, and keep gold available for purchases and tolls.' },
  { title: 'Check your goal', text: 'The player panel shows this voyage’s colony goal or king’s missions. Open Rules for the full victory conditions. Select any underlined stat to see what it means.' },
] as const;

export const STAT_HELP = {
  round: { label: 'Round', description: 'The round advances once every active navigator has taken a turn.' },
  goal: { label: 'Victory goal', description: 'The colony target or campaign objective for this voyage. Open Rules for the full victory conditions.' },
  rank: { label: 'Royal rank', description: 'The crown can promote you when you return home. Higher ranks improve royal benefits and unlock captains.' },
  gold: { label: 'Gold', description: 'Spendable gold for claiming islands, construction, purchases and paying tolls or taxes.' },
  islands: { label: 'Colonies', description: 'The number of new continents this navigator currently controls.' },
  ships: { label: 'Sailing ships', description: 'Ships traveling with this fleet. Ships docked at colonies are counted separately.' },
  captains: { label: 'Captains aboard', description: 'Recruited captains grant bonuses such as better royal salary or lower tolls and taxes.' },
  durability: { label: 'Durability', description: 'The hull strength remaining out of the ship’s maximum. A ship at zero durability sinks.' },
  firepower: { label: 'Firepower', description: 'The ship’s base cannon damage per volley in a naval battle.' },
  cargoCapacity: { label: 'Cargo capacity', description: 'Goods loaded in the hold out of the total number of units this ship can carry.' },
  speed: { label: 'Speed', description: 'The ship’s speed rating. The compass, not ship speed, determines movement in this voyage.' },
  crewCapacity: { label: 'Crew capacity', description: 'The ship’s sailor capacity rating. Individual sailors are not tracked in this voyage.' },
  netWorth: { label: 'Net worth', description: 'Your gold plus the end-of-voyage value of your colonies and buildings.' },
  toll: { label: 'Toll', description: 'The fee owed when a rival lands on a colony. The amount paid can be reduced by captain bonuses.' },
  price: { label: 'Claim price', description: 'The gold needed to claim this uncharted island as a colony.' },
  storage: { label: 'Colony storage', description: 'Goods stored on the island and available for cargo transfers or shipbuilding.' },
  production: { label: 'Production per round', description: 'Goods added to this colony’s stockpile by its buildings each round.' },
  progress: { label: 'Mission progress', description: 'The amount completed out of the target, followed by the gold awarded for finishing this royal mission.' },
  cards: { label: 'Strategy cards', description: 'Strategy cards currently held by this navigator. You may use at most one card per turn.' },
  marketStock: { label: 'Market stock and cargo', description: 'Units for sale at this market, followed by units of the selected good already aboard your selected ship.' },
  marketPrice: { label: 'Market prices', description: 'The buy and sell prices for the next unit. Prices can change as stock changes.' },
  freeHold: { label: 'Free hold', description: 'Empty cargo space on the selected ship, measured in units.' },
  lotteryPicks: { label: 'Lottery picks', description: 'Numbers you have bought out of the maximum allowed for this draw.' },
  lotteryOdds: { label: 'Lottery odds', description: 'The chance of getting exactly this many matches with your current number of picks.' },
  buildingLevel: { label: 'Building level', description: 'The current size of this facility. Upgrading to a larger facility improves what the colony can produce or build.' },
} as const;

export type Stat = keyof typeof STAT_HELP;

const PLAYER_COLORS = [
  0x56b4e9, 0xe69f00, 0xcc79a7, 0xf0e442, 0x009e73,
  0xd55e00, 0x0072b2, 0xffffff, 0xaab4c3, 0xb892ef,
] as const;

export function chartIdentity(player: { id: number; color: number }, colorBlind: boolean) {
  return {
    color: colorBlind ? PLAYER_COLORS[player.id % PLAYER_COLORS.length] : player.color,
    badge: colorBlind ? String(player.id + 1) : null,
  };
}
