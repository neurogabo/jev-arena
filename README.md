# Jev Arena

A Pokémon Champions battle arena where you play against Jev, TypeSafe's decision model. The app runs locally with a pinned Pokémon Showdown engine, team selection, random teams, battle animations, and private decision reviews.

This repository contains the current arena application and the knowledge it needs. Research experiments, historical versions, benchmark archives, test suites, deployment credentials, and player data are excluded.

## Run locally

Install **Node.js 24.16 or later** and Git. Use Node 24 LTS for the verified setup. Windows and macOS provide the `tar` command used by setup. On Debian/Ubuntu, first install ZIP extraction support:

```sh
sudo apt-get install libarchive-tools
```

Clone your fork, or download and extract this repository. In its root directory:

```sh
npm ci
npm run setup
npm run start:offline
```

Open **http://127.0.0.1:8160**. Choose teams, try **Random teams**, and start a battle. Offline mode uses a scripted opponent and makes no TypeSafe API calls. Initial setup downloads and builds the pinned engine and client, which can take several minutes. Visual and audio assets can still require internet access.

To play against Jev, stop the server, edit the `.env` created by setup, and fill in your own key:

```dotenv
TYPESAFE_API_KEY=
```

Then run:

```sh
npm start
```

Obtain your key through [TypeSafe](https://docs.typesafe.ai/sdk/javascript). Jev runs on TypeSafe's service; inference is not hosted on your computer. Live play uses your account's quota. Your key remains on your local server and is excluded from Git. Setup preserves an existing `.env`.

## Configuration

Edit `.env` for the port, origin, concurrency and request limits. When changing ports, update both `ARENA_PORT` and `ARENA_ORIGIN`. Use the exact origin in the browser; `localhost` and `127.0.0.1` are different origins.

The default is one battle worker, three queued matches, 500 API calls per day and 150 per battle. An optional monthly input-token allowance is available; these limits are not a currency spending cap. Use provider-side limits as appropriate for your account. Offline battles are excluded from the live scoreboard.

The app creates `.arena-data/` for its local SQLite database, reviews and diagnostic traces. `.runtime/` holds downloaded engine/client code. Both directories and `.env` are ignored by Git. Use one server process per data directory. Restarting abandons unfinished battles while preserving completed reviews.

## Find your way around

| Path | Purpose |
| --- | --- |
| `src/public/` | HTTP server, sessions, SQLite, limits and battle workers |
| `src/showdown/` | Battle observation, legal actions, team loading and browser UI |
| `src/jev.ts` | Server-side TypeSafe API boundary |
| `src/live-sim/`, `src/live-top4/`, `src/team-context/` | Current decision pipeline, simulation, team brief and memory |
| `src/knowledge/`, `src/context-*/`, `src/sim-v1/` | Shared helpers used by that pipeline |
| `teams/` | Team catalog, published sources and documented training allocations |
| `docs/wiki/` | Required knowledge cards, relationships and source references |
| `lab.config.json`, `showdown.lock.json` | Model/context settings and pinned simulator revisions |
| `scripts/` | Setup and lightweight verification commands |

Some helper directories retain version numbers because the current pipeline imports them. They are runtime dependencies, not alternative application releases. See [architecture and customization](docs/ARCHITECTURE.md).

## Verify a fork

```sh
npm run typecheck
npm run verify-data
npm run check-public
```

`verify-data` loads the knowledge and validates every catalog team against the pinned engine without calling TypeSafe. `check-public` requires Git and checks tracked/nonignored source files for private artifacts and common credential mistakes. GitHub Actions also runs Gitleaks on the repository history. These checks do not replace testing changes to decision behavior.

If setup is interrupted, stop the app, move only `.runtime/` to a backup location outside the repository, and rerun setup. A missing `bsdtar` error on Linux means `libarchive-tools` is needed. For a busy port, change the port and origin together.

## Independence from the hosted arena

This source distribution has no deployment workflow, cloud project configuration, production domain settings, or shared player database. Running or changing a fork uses its own local configuration and data. See [publication and hosting boundaries](docs/PUBLISHING.md) before deploying your own instance.

## License

Original code and original documentation use the [MIT License](LICENSE). Pokémon Showdown, fonts, external data, artwork and trademarks retain their own terms; see [third-party notices](THIRD_PARTY_NOTICES.md). In particular, the downloaded Showdown client has AGPLv3 obligations. This is an independent fan/research project, not an official Pokémon or TypeSafe product.
