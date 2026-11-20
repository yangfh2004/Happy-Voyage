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

## Online rooms

With Node.js 20+, run `npm ci && npm run build && npm start` from the repo root.
Open **http://localhost:3000** in a browser, select **Host online room**, and share the invite link. Guests open it in their own browser, pick distinct nations, and join. The host can start once 2–6 people are connected; AI plays the other nations. Choose **Sprint** for the shortest match.

To play from another device, use a server address both devices can reach (not `localhost`). The static demo supports local play only. Online hosting needs one always-running Node.js service serving the built client and Socket.IO on the same origin, with HTTPS and WebSocket upgrades supported by its reverse proxy. Rooms are in memory: a restart clears them, so don't run multiple replicas. No database is needed.

Refreshing the invite in the same tab restores your seat; a match waits when a disconnected player is at the helm. Empty rooms eventually expire, and seats in the pre-game lobby expire after a short disconnect grace period.

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
shared/   Game rules, independent of any renderer (runs on the server for online rooms)
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
  src/lobby.ts     Online lobby, seats, invites and reconnects
  src/roomMatch.ts Authoritative online match, including AI and timers
  src/db.ts        Optional PostgreSQL pool
```

The engine never touches the screen: it changes `GameState` and emits `GameEvent`s.
`OceanScene` animates `moved` events and reports `move-complete`, after which the
controller calls `resolveLanding()` in local games. In online rooms the server advances the
same engine independently of the clients and sends state and events over Socket.IO.

## Running it

Requires Node.js 20+.

```bash
npm install
npm run dev          # client at http://localhost:5173
npm run dev:server   # in a separate terminal for online rooms in Vite
npm test             # rules and server tests
npm run typecheck
npm run build        # production client build in client/dist
npm start            # Express server at http://localhost:3000 (serves the built client)
npm exec -- vite-node shared/playtest.ts 360 10000  # 360 seeds starting at 10,001
```

Pushes to `main` publish the built client to the `demo` branch (served by the link above) and to
GitHub Pages; the Pages deploy is skipped until Pages is enabled
in the repository settings (Settings > Pages > Source: GitHub Actions).

### AI balance playtest

The command above played **3,960** matches on the standard map, using seeds not used to tune Hard.
Duels swap difficulties across the same two nations per seed. Mixed games rotate difficulty assignments across nations.
Hard prioritizes affordable warships, forecasts its next compass spin, looks for safe captures, and saves money for claims instead of spending it all on buildings. It plays by the same rules and starts with the same resources as the other difficulties.

| Preset and matchup | Games | Win rate |
| --- | ---: | --- |
| Classic: Normal vs. Easy | 720 | 75.3% vs. 24.7% |
| Classic: Hard vs. Normal | 720 | 70.6% vs. 29.4% |
| Classic: Hard vs. Easy | 720 | 89.2% vs. 10.8% |
| Classic: ten Normal rivals | 360 | Individual nations: 5.8–19.7% |
| Classic: ten mixed rivals | 360 | Easy 5.6%, Normal 8.3%, Hard 16.2% per seat |
| Quick: Hard vs. Normal | 720 | 68.3% vs. 31.7% |

On the same seeds, the previous Hard won 51.4% against Normal in Classic and 50.4% in Quick. All simulated Classic games ended by survival rather than capturing all continents; the new Hard went bankrupt in 29.4% of Classic duels against Normal. These are AI self-play results, not estimates of human win rates.

A separate 360-game economy stress test used three rivals, 3,500 starting gold, a 40-island goal and a 50-round limit. Hard won 66.9%, Normal 27.8%, and Easy 5.3%. Activity per 100 active turns:

| Difficulty | Building levels added | Ships built / bought | Market and merchant trades | Attacks | Cards played |
| --- | ---: | ---: | ---: | ---: | ---: |
| Easy | 3.85 | 0.02 / 0.62 | 0.23 | 1.22 | 6.01 |
| Normal | 17.15 | 0.33 / 0.46 | 0.29 | 3.50 | 7.23 |
| Hard | 24.00 | 0.55 / 3.21 | 0.55 | 7.43 | 9.85 |
