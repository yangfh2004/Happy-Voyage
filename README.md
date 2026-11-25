# Happy Voyage: Seven Seas Domination

A modern browser remake of the late-1990s Taiwanese game **Happy Voyage (欢乐大航海)**:
Monopoly-style turn-based occupation meets Uncharted Waters-style fleets, trading and colonies.

**Play the demo:** https://raw.githack.com/yangfh2004/Happy-Voyage/demo/index.html (latest `main`)

**Gameplay rules:** [简体中文 (canonical)](GAMEPLAY.md) · [English](GAMEPLAY.en.md). The Chinese version is the single source of truth, including for campaigns and online rooms. PRs that change gameplay must update the Chinese rules, and any PR that changes them must also update the English translation.

## Desktop downloads / 桌面版下载

Get the ZIP for your computer from [GitHub Releases](https://github.com/yangfh2004/Happy-Voyage/releases). New ZIPs include the app, `config.json`, and two Chinese PDFs: `Happy-Voyage-玩法说明.pdf` and `Happy-Voyage-配置说明.pdf`. Local play requires neither an installer nor internet access. / 新版 ZIP 包含游戏、配置文件、中文版玩法和配置说明两份 PDF。本机游玩无需安装或联网。

Edit `config.json` next to the Windows EXE or macOS App and relaunch to change local gameplay values. Missing or malformed files fall back to defaults; online rooms keep server rules. / 编辑与 Windows EXE 或 macOS App 同目录的 `config.json`，重启后即可自定义本机玩法。文件缺失或格式错误时使用默认值；在线房间始终以服务器为准。详见[配置说明](配置说明.md)。

- **Windows (x64):** Download `happy-voyage-win-x64.zip`, extract it, and double-click the portable `.exe`. / 下载并解压 Windows ZIP 后，双击便携版 `.exe`。
- **macOS:** Download the `arm64` ZIP for Apple silicon or the `x64` ZIP for Intel. Unzip it and open **Happy Voyage.app**. If macOS blocks the first launch, right-click the app and choose **Open**, or use **System Settings → Privacy & Security → Open Anyway**. / Apple 芯片下载 `arm64`，Intel 下载 `x64`。解压后打开应用；若首次运行被拦截，右键选择「打开」，或前往「系统设置 → 隐私与安全性 → 仍要打开」。
  Before launching with a custom config, use Finder to move the **app itself** out of Downloads into a folder you own, then put `config.json` beside it. macOS may otherwise run the app from a temporary mount where it cannot find its original neighboring files. / 若要使用自定义配置，请先在 Finder 中将 **App 本身**移出「下载」目录，放入自己的文件夹，再把 `config.json` 放到 App 同目录。否则 macOS 可能从临时挂载位置运行 App，导致它找不到原目录中的配置。

Publishing a GitHub release runs the desktop packaging workflow. To add or replace binaries on an existing release whose tag includes desktop configuration support, run **Publish desktop builds** in Actions and enter its tag.

## Online rooms

On the [public demo](https://raw.githack.com/yangfh2004/Happy-Voyage/demo/index.html), select **Host online room** and share the invite link. The free room server can sleep when idle, so the first connection may take about a minute. See the online room rules in [English](GAMEPLAY.en.md#10-computer-opponents-and-online-rooms) or [Chinese](GAMEPLAY.md#10-电脑对手与在线房间) for how to start and play.

### Local hosting

With Node.js 20+, run `npm ci && npm run build && npm start` from the repo root.
Open **http://localhost:3000** in a browser, select **Host online room**, and share the invite link.

To play from another device on your network, use a server address both devices can reach (not `localhost`). Rooms are in memory: a restart clears them, so don't run multiple replicas. No database is needed.

### Deploy the public room server

1. After the Blueprint is merged to `main`, sign in to [Render and create a Blueprint](https://dashboard.render.com/blueprints/new). Connect GitHub, grant Render access to [yangfh2004/Happy-Voyage](https://github.com/yangfh2004/Happy-Voyage), select the repo and `main`, and deploy the free `happy-voyage` service from `render.yaml`. No database or environment secrets are required.
2. Wait for the service to go live, then open [the health check](https://happy-voyage.onrender.com/healthz). If Render assigned a different URL, use that URL instead and set the GitHub repository's [Actions variable](https://github.com/yangfh2004/Happy-Voyage/settings/variables/actions) `RENDER_SERVER_URL` to the service's HTTPS origin.
3. Check the [Publish demo workflow](https://github.com/yangfh2004/Happy-Voyage/actions/workflows/demo.yml) on `main`. Run it again if you changed the Actions variable. Open the demo, create a room, and open its invite in a second browser to join.

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
  src/engine.ts    GameEngine: turn and landing resolution
  src/ai.ts        AI rival decisions
client/   Phaser + React front end
  src/game/GameController.ts   Owns the engine, runs AI turns, notifies React and Phaser
  src/game/EventBus.ts         Events between React, the controller and scenes
  src/game/scenes/             BootScene (generated placeholder art), OceanScene (sea, route, fleets)
  src/ui/                      React overlays: setup menu, player bar, action panel, ship's log
server/   Express + Socket.IO
  src/index.ts     /healthz, /api/health, /api/map, serves client/dist
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
npm test -w client   # client tests
npm run typecheck
npm run build        # production client build in client/dist
npm start            # Express server at http://localhost:3000 (serves the built client)
npm exec -- vite-node shared/playtest.ts 360 10000  # 360 seeds starting at 10,001
```

Pushes to `main` publish the built client to the `demo` branch (served by the link above) and to
GitHub Pages; the Pages deploy is skipped until Pages is enabled
in the repository settings (Settings > Pages > Source: GitHub Actions).

### Debug window tester

With `npm run dev` running, open [the window tester](http://localhost:5173/debug.html).
Choose a window to launch a playable scenario, then use **Reset** to replay it or **All windows**
to pick another. The language control switches both the tester and the game.

`npm run build:debug -w client` writes a static build to `client/dist-debug`. The demo workflow
publishes it separately to the `demo-debug` branch; a pinned link ends in `/<demo-debug commit>/debug.html`.
The release build, normal demo, and GitHub Pages do not include the tester or its scenarios.

### AI balance playtest

The command above played **3,960** matches on the standard map, using seeds not used to tune Hard.
Duels swap difficulties across the same two nations per seed. Mixed games rotate difficulty assignments across nations.

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
