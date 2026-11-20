import { aiShouldClaim } from './src/ai';
import { GameEngine } from './src/engine';

type Policy = (game: GameEngine) => boolean;

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32;
  };
}

const policies: Record<string, Policy> = {
  builtIn: (g) => aiShouldClaim(g.state, g.currentPlayer, g.state.pendingClaim!),
  buyAll: () => true,
  reserve150: (g) => g.currentPlayer.gold - g.state.map[g.state.pendingClaim!].price! >= 150,
  reserve300: (g) => g.currentPlayer.gold - g.state.map[g.state.pendingClaim!].price! >= 300,
  hoard: () => false,
  navigator: (g) => {
    const { currentPlayer: player, state } = g;
    if (g.islandsOwnedBy(player.id) + 1 >= state.config.islandsToWin) return true;
    const risk = state.map
      .slice(player.position + 2, player.position + 13)
      .filter((n) => state.owners[n.id] !== null && state.owners[n.id] !== player.id)
      .map((n) => n.toll!);
    return player.gold - state.map[state.pendingClaim!].price! >=
      (risk.length ? Math.max(...risk) + 40 : 100);
  },
};

const count = Number(process.argv[2] ?? 1000);
for (const players of [2, 3, 4]) {
  for (const [name, policy] of Object.entries(policies)) {
    const wins = Array<number>(players).fill(0);
    const endings = { conquest: 0, survival: 0, score: 0 };
    let rounds = 0;
    let turns = 0;
    let winnerScore = 0;
    let margin = 0;
    let bankruptcies = 0;
    const offers = { accepted: 0, total: 0 };

    for (let seed = 1; seed <= count; seed++) {
      const seat = (seed - 1) % players;
      const game = new GameEngine({
        players: Array.from({ length: players }, (_, i) => ({ name: `Seat ${i + 1}`, color: i, isAI: i !== seat })),
        rng: seeded(seed),
      });
      game.on((event) => {
        if (event.type === 'bankrupt') bankruptcies++;
        if (event.type === 'gameOver') {
          if (event.reason.startsWith('claimed')) endings.conquest++;
          else if (event.reason.startsWith('is the richest')) endings.score++;
          else endings.survival++;
        }
      });
      game.start();
      while (game.state.phase !== 'gameOver') {
        const isChallenger = game.currentPlayer.id === seat;
        game.spinCompass();
        game.sail();
        while (game.state.phase === 'moving') game.resolveLanding();
        if (game.state.phase === 'awaitingClaim') {
          const claim = (isChallenger ? policy : policies.builtIn)(game);
          if (isChallenger) {
            offers.total++;
            if (claim) offers.accepted++;
          }
          if (claim) game.claim();
          else game.decline();
        }
        turns++;
      }
      const winner = game.state.winner!;
      if (name === 'builtIn') wins[winner]++;
      else if (winner === seat) wins[seat]++;
      rounds += Math.min(game.state.round, game.state.config.maxRounds);
      const score = game.netWorth(winner);
      winnerScore += score;
      margin += score - Math.max(...game.state.players.filter((p) => p.id !== winner).map((p) => game.netWorth(p.id)));
    }

    console.log(JSON.stringify({ players, policy: name, winPct: wins.map((n) => (n * 100 / count).toFixed(1)),
      winTotalPct: +(wins.reduce((a, b) => a + b, 0) * 100 / count).toFixed(1),
      meanRounds: +(rounds / count).toFixed(1), meanTurns: +(turns / count).toFixed(1), winnerScore: Math.round(winnerScore / count),
      meanWinnerMargin: Math.round(margin / count), bankruptPctPerPlayer: +(bankruptcies * 100 / count / players).toFixed(1),
      claimPct: +(offers.accepted * 100 / offers.total).toFixed(1), endings }));
  }
}
