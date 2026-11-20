import { GameEngine } from './src/engine';
import { DEFAULT_ISLAND_COUNT, gameMode, hasRoundLimit } from './src/modes';
import { createNationRoster, NATIONS } from './src/nations';
import type { GameConfig, PlayerSetup } from './src/types';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32;
  };
}

const levels = ['easy', 'normal', 'hard'] as const;
const roster = createNationRoster([{ name: 'Columbus', nation: 'Spain' }]);
const seeds = Number(process.argv[2] ?? 300);
const offset = Number(process.argv[3] ?? 0);
const scenario = process.argv[4];
let scenariosRun = 0;
if (!Number.isSafeInteger(seeds) || seeds < 1) throw new Error('Supply a positive seed count');
if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(offset + seeds)) throw new Error('Supply a nonnegative seed offset');

function stats() {
  return {
    seats: 0, wins: 0, turns: 0, bankruptcies: 0, score: 0, colonies: 0,
    buildings: 0, builtShips: 0, boughtShips: 0, trades: 0, battles: 0, battleWins: 0, cards: 0,
  };
}

function run(name: string, fixtures: (seed: number) => PlayerSetup[][], config?: Partial<GameConfig>) {
  if (scenario && scenario !== name) return;
  scenariosRun++;
  const byLevel = { easy: stats(), normal: stats(), hard: stats() };
  const nationWins = Object.fromEntries(NATIONS.map(({ name }) => [name, 0]));
  const endings = { conquest: 0, survival: 0, wealth: 0 };
  let games = 0;
  let rounds = 0;

  for (let seed = offset; seed < offset + seeds; seed++) {
    for (const players of fixtures(seed)) {
      const game = new GameEngine({ players, config, rng: seeded(seed + 1) });
      const { state } = game;
      const row = (id: number) => byLevel[players[id].aiDifficulty!];
      game.on((event) => {
        switch (event.type) {
          case 'turnStarted': row(event.playerId).turns++; break;
          case 'buildingBuilt': row(event.playerId).buildings++; break;
          case 'shipAdded':
            if (state.phase === 'awaitingBuild') row(event.playerId).builtShips++;
            if (state.phase === 'awaitingMarket') row(event.playerId).boughtShips++;
            break;
          case 'marketTrade': row(event.playerId).trades++; break;
          case 'seaEvent':
            if (event.event === 'merchant' && event.outcome === 'accepted') row(event.playerId).trades++;
            break;
          case 'battleFought':
            row(event.report.attacker).battles++;
            if (event.report.outcome === 'victory') row(event.report.attacker).battleWins++;
            break;
          case 'strategyUsed': row(event.playerId).cards++; break;
          case 'gameOver':
            if (event.victory === 'everyContinent' || event.victory === 'islandGoal') endings.conquest++;
            else if (event.victory === 'richest') endings.wealth++;
            else endings.survival++;
            break;
        }
      });
      game.start();
      for (let actions = 0; state.phase !== 'gameOver'; actions++) {
        if (actions >= state.config.maxRounds * players.length * 16) {
          throw new Error(`Stalled: ${name} seed ${seed + 1}, round ${state.round}, phase ${state.phase}`);
        }
        if (state.phase === 'spinning') game.sail();
        else if (state.phase === 'moving') game.resolveLanding();
        else {
          const { phase, currentPlayer, round } = state;
          game.decideForAI();
          const sameTurn = state.currentPlayer === currentPlayer && state.round === round;
          if (sameTurn && state.phase === phase) {
            if (phase !== 'awaitingSpin') throw new Error(`Unhandled AI decision: ${phase}`);
            game.spinCompass();
          }
        }
      }
      games++;
      rounds += hasRoundLimit(state.config) ? Math.min(state.config.maxRounds, state.round) : state.round;
      nationWins[players[state.winner!].nation!]++;
      for (const player of state.players) {
        const result = row(player.id);
        result.seats++;
        if (state.winner === player.id) result.wins++;
        if (player.bankrupt) result.bankruptcies++;
        result.score += game.netWorth(player.id);
        result.colonies += game.islandsOwnedBy(player.id);
      }
    }
  }

  const ratio = (n: number, d: number) => +(n / d).toFixed(2);
  console.log(JSON.stringify({
    name, games, firstSeed: offset + 1, lastSeed: offset + seeds, meanRounds: ratio(rounds, games), endings, nationWins,
    levels: Object.fromEntries(levels.filter((level) => byLevel[level].seats > 0).map((level) => {
      const { seats, wins, bankruptcies, score, colonies, turns, battleWins, battles, ...actions } = byLevel[level];
      return [level, {
        seats, wins, winPct: ratio(wins * 100, seats), bankruptPct: ratio(bankruptcies * 100, seats),
        meanWealth: ratio(score, seats), meanColonies: ratio(colonies, seats),
        battleWinPct: battles ? ratio(battleWins * 100, battles) : null,
        per100Turns: Object.fromEntries(Object.entries({ ...actions, battles }).map(([action, count]) => [action, ratio(count * 100, turns)])),
      }];
    })),
  }));
}

function duel(mode: 'conquest' | 'quick', lower: typeof levels[number], higher: typeof levels[number]) {
  run(`${gameMode(mode).name}: ${higher} vs ${lower}`, (seed) => {
    const i = seed % roster.length;
    const j = (i + 1 + Math.floor(seed / roster.length) % (roster.length - 1)) % roster.length;
    return [[lower, higher], [higher, lower]].map((pair) =>
      [roster[i], roster[j]].map((seat, index) => ({ ...seat, isAI: true, aiDifficulty: pair[index] })));
  }, gameMode(mode).config);
}

duel('conquest', 'easy', 'normal');
duel('conquest', 'normal', 'hard');
duel('conquest', 'easy', 'hard');
duel('quick', 'normal', 'hard');

run('10-nation Normal self-play', () => [roster.map((seat) => ({ ...seat, isAI: true, aiDifficulty: 'normal' }))]);
run('10-nation mixed difficulty', (seed) => [
  roster.map((seat, index) => ({ ...seat, isAI: true, aiDifficulty: levels[(index + seed) % levels.length] })),
]);

run('Economy stress test (custom rules)', (seed) => [
  Array.from({ length: 3 }, (_, i) => ({
    ...roster[(seed + i * 3) % roster.length], isAI: true, aiDifficulty: levels[(seed + i) % levels.length],
  })),
], { startingGold: 3500, islandsToWin: DEFAULT_ISLAND_COUNT, maxRounds: 50 });

if (scenariosRun === 0) throw new Error(`Unknown scenario: ${scenario}`);
