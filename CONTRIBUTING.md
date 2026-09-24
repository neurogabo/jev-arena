# Contributing

Fork the repository, create a branch, and follow the root README to run the arena locally. Describe the behavior your change improves and how you checked it. Keep changes focused enough to review.

Before opening a pull request, run `npm run typecheck`, `npm run verify-data` and `npm run check-public`. Exercise the affected flow in offline mode. Changes to model decisions also need representative behavior checks; offline play alone does not validate Jev quality.

Keep exact mechanics and legal actions in the engine. Do not expose hidden opponent state to the decision model or browser. Preserve source attribution when changing teams or knowledge. Do not commit credentials, runtime downloads, databases, traces or experiment archives.

The public distribution includes lightweight verification commands; the historical research and full test collection are maintained separately. Contributions to original code are under the repository's MIT license. Retain third-party licenses and notices.
