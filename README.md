# Happy Voyage: Seven Seas Domination

A modern browser remake of the late-1990s Taiwanese game **Happy Voyage (欢乐大航海)**:
Monopoly-style turn-based occupation meets Uncharted Waters-style fleets, trading and colonies.

**Play the demo:** https://raw.githack.com/yangfh2004/Happy-Voyage/demo/index.html (latest `main`)

## The first playable version

Pick one of ten nations and start at its home port. The other nine nations are AI rivals.

- Spin the compass to sail 2–12 stops around a 70-stop sea route. Set the game speed or skip animations and AI turns until your next decision.
- Open **Fleet** to inspect any navigator's starting warship, cargo ship, and explorer.
- Land on an unowned island to found a colony; rivals who land there pay you a toll.
- Passing the home port pays a royal salary; event stops bring treasure, storms or trade winds.
- Claim 10 islands, be the last navigator afloat, or be the richest after 50 rounds to win.
- The opening turn rotates each round. End-of-voyage wealth is cash plus 75% of each colony's cost (rounded down); a colony needs time to earn back that difference.

Trading, shipbuilding, naval combat, special islands and multiplayer come next.

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
npm exec -- vite-node shared/playtest.ts 6000  # seeded AI and strategy playtests (games per matchup)
```

Pushes to `main` publish the built client to the `demo` branch (served by the link above) and to
GitHub Pages; the Pages deploy is skipped until Pages is enabled
in the repository settings (Settings > Pages > Source: GitHub Actions).
