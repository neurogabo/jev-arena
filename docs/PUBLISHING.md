# Publication and hosting boundaries

This repository is a standalone source distribution. It starts with a fresh Git history and includes the latest arena application, its required data and licenses. It does not contain the private development branches, old experiments, test collections, production setup or player records.

## Publish without changing an existing deployment

Create a **new repository** for this distribution and push only its `main` branch. Do not change the visibility of a private development repository or mirror its branches and tags. A fresh repository avoids publishing history that was intentionally excluded from this snapshot.

The included GitHub Actions workflow installs dependencies, validates source/data and scans for secrets. It has read-only repository permissions and no deployment steps. It needs no TypeSafe API key or cloud credentials. Do not add an existing production webhook, deployment key, cloud trigger or deployment environment to this repository.

Publishing this source does not update an already running application. Keep its immutable container image, deployment configuration, secrets and persistent data under the existing operator's control. Changes to the public source should reach that service only through a separately reviewed release process.

## Run an independent hosted instance

Local setup binds to loopback. Hosting requires your own domain, HTTPS proxy, server, TypeSafe key and persistent data directory. Configure the exact external origin and trust proxy settings deliberately. Keep one coordinator per SQLite directory; do not scale multiple server instances against the same database.

Never copy production `.env` files, databases, reviews or traces into this source tree for publication. Use a private secret store and a separate persistent volume. Preserve the corresponding source and notices required by the downloaded Showdown client's AGPLv3 terms when redistributing or publicly hosting modifications.

Future public releases should be reviewed source-only updates to this repository, with no private branches or history imported.
