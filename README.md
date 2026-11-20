# Happy Voyage: Seven Seas Domination

A modern browser remake of the late-1990s Taiwanese game **Happy Voyage (欢乐大航海)**:
Monopoly-style turn-based occupation meets Uncharted Waters-style fleets, trading and colonies.

**Play the demo:** https://raw.githack.com/yangfh2004/Happy-Voyage/demo/index.html (latest `main`)

## The first playable version

Pick one of ten nations and start at its home port. The other nine nations are AI rivals.
Choose Easy, Normal, or Hard before setting sail. Difficulty changes rival decisions, not starting resources, dice, or ship stats.

- Spin the compass to sail 2–12 stops around a 70-stop sea route. Set the game speed or skip animations and AI turns until your next decision.
- Each nation sails with its historical navigator (Columbus, Juliana, Cook, Magellan, Zheng He, Morgan and more), shown with a portrait in setup and the player bar; their signature flagship replaces one starting ship.
- Open **Fleet** to inspect any navigator's ships, including new ships launched from a colony (★ marks the signature ship).
- Land on an unowned island to found a colony; rivals who land there pay you a toll.
- Revisit a colony to build a lumber mill, iron mine, and shipyard. Spend the colony's lumber and iron to build an Explorer (small yard), Cargo Ship (medium), or Warship (large).
- Passing the home port pays a royal salary; event stops bring treasure, storms or trade winds.
- Claim 10 islands, be the last navigator afloat, or be the richest after 50 rounds to win.
- The opening turn rotates each round. End-of-voyage wealth is cash plus 75% of each colony's cost (rounded down); a colony needs time to earn back that difference.

Expanded trading, naval combat, and multiplayer come next.

## Royal campaign

Choose **Campaign** at setup and start any stage. Each stage gives you a **Navigate**
card to reach a destination of your choice without spinning. The king pays a gold
reward for each mission; finish both without going bankrupt to clear the stage.

| Stage | King's missions | Challenge |
| --- | --- | --- |
| First Voyage | Found a colony and land at your home port while holding one. | One Easy rival; no deadline. |
| The Merchant Charter | Sell 3 specialties at Nightless Island and build a collection field. | Two Normal rivals; 28 rounds. |
| Crown of the Seas | Hold 2 colonies at once and capture a rival colony in battle. | Three Hard rivals; 20 rounds and less starting gold. |

## Tech stack

| Part | Tech |
| --- | --- |
| Game rendering | Phaser 3 + TypeScript |
| Menus and panels | React 18 overlaid on the Phaser canvas |
| Build | Vite |
| Server | Node.js + Express, Socket.IO for multiplayer |
| Database | PostgreSQL via `pg` (optional, off unless `DATABASE_URL` is set) |
| Tests | Vitest |

## Project structure

npm workspaces monorepo:

```
shared/   Game rules, independent of any renderer (runs in the browser now, on the server later)
  src/types.ts     Plain serialisable state: players, map nodes, game state, events
  src/map.ts       The sea route (add stops here)
  src/engine.ts    GameEngine: spin compass -> sail -> resolve landing -> claim/decline -> next turn
  src/ai.ts        AI rival decisions
client/   Phaser + React front end
  src/game/GameController.ts   Owns the engine, runs AI turns, notifies React and Phaser
  src/game/EventBus.ts         Events between React, the controller and scenes
  src/game/scenes/             BootScene (generated placeholder art), OceanScene (sea, route, fleets)
  src/ui/                      React overlays: setup menu, player bar, action panel, ship's log
server/   Express + Socket.IO
  src/index.ts     /api/health, /api/map, serves client/dist
  src/lobby.ts     Multiplayer room skeleton
  src/db.ts        Optional PostgreSQL pool
```

The engine never touches the screen: it changes `GameState` and emits `GameEvent`s.
`OceanScene` animates `moved` events and reports `move-complete`, after which the
controller calls `resolveLanding()`. Multiplayer will run the same engine on the server
and relay its events over Socket.IO.

## Running it

Requires Node.js 20+.

```bash
npm install
npm run dev          # client at http://localhost:5173
npm test             # rules tests
npm run typecheck
npm run build        # production client build in client/dist
npm start            # Express server at http://localhost:3000 (serves the built client)
npm exec -- vite-node shared/playtest.ts 360  # seeds per scenario; duels swap the two policies per seed
```

Pushes to `main` publish the built client to the `demo` branch (served by the link above) and to
GitHub Pages; the Pages deploy is skipped until Pages is enabled
in the repository settings (Settings > Pages > Source: GitHub Actions).

### AI balance playtest

The command above played **3,240** complete matches on the default map with real navigator fleets.
Duels swap difficulty assignments for the same seed and nations; ten-nation games rotate difficulty assignments across nations.

| Default-rule matchup | Games | Win rate |
| --- | ---: | --- |
| Normal vs. Easy | 720 | 73.2% vs. 26.8% |
| Hard vs. Normal | 720 | 51.4% vs. 48.6% |
| Hard vs. Easy | 720 | 73.8% vs. 26.3% |
| Ten Normal rivals | 360 | Individual nations: 6.9–13.1% |
| Ten mixed rivals | 360 | Easy 4.2%, Normal 12.8%, Hard 13.1% per seat |

Hard and Normal were close in competitive play. Ten-nation games lasted about 20 rounds; over 99% ended in conquest, so there were few opportunities to revisit colonies and ship goods. In mixed games, 45–50% of seats went bankrupt.

A separate 360-game economy stress test used three rivals, 3,500 starting gold, and disabled conquest by setting the goal above the map's island count. Activity per 100 active turns:

| Difficulty | Building levels added | Ships built / bought | Market and merchant trades | Attacks | Cards played |
| --- | ---: | ---: | ---: | ---: | ---: |
| Easy | 4.20 | 0.00 / 0.48 | 0.17 | 1.62 | 4.78 |
| Normal | 19.82 | 0.57 / 0.44 | 0.45 | 5.57 | 7.39 |
| Hard | 25.12 | 0.84 / 1.21 | 0.79 | 5.00 | 7.52 |

Normal won 47.8% of the stress games, Hard 43.1%, and Easy 9.2%. Hard invested and traded more and won a greater share of the battles it chose, but that did not make it the most successful policy under wealth and survival rules. These are AI self-play results, not estimates of human win rates.
