# Worlds 2026 Masters top cut

The catalog now includes all 13 Masters top-cut players from the 2026 World Championships. Takuma Yamazaki's complete published spread remains in `../worlds-2026.json`; the twelve additional teams here cover ranks 2–13. The existing Seniors champion is also preserved. This is top-cut coverage, not the entire Worlds field.

Sources: [Limitless final standings](https://limitlessvgc.com/tournaments/437) and each player's linked public team sheet. [Victory Road](https://victoryroad.pro/2026-worlds/) identifies the 13-player top cut and competition dates, August 28–30. Limitless dates the overall event August 27; both observations are retained in event metadata. Numeric ranks identify the source order; they do not imply separate placement matches.

These teams originated in Regulation M-B. All are independently validated under the pinned Regulation M-C engine before play. Species, moves, items, abilities and natures are copied from the public sheets; no substitutions are made. Training points are absent from those sheets, so each added Pokémon has an explicitly documented wiki build allocation with a source hash and build reference. These reconstructed points are not presented as the player's tournament spread.

Rebuild from checked-in captures (offline):

```sh
npx tsx scripts/import-tournament-teams.ts --worlds
```

Add `--fetch` to refresh public captures. The importer checks the expected rank and player before importing, and preserves other events. Every team must pass provenance checks and M-C legality validation.
