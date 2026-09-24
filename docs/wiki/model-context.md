# Model context contract

Jev receives battle-relevant cards. Each Pokémon/form has one unified card under `pokemon:<id>`, combining identity and competitive knowledge. Source history and collection details stay in the offline wiki records.

## What a Pokémon card contains

- Exact form, types, species base stats, intrinsic abilities, and relevant form relationships.
- Role and a few coherent build candidates: item, ability, nature, allocated Champions stat points, calculated stats, and four moves.
- Clearly identified move or item alternatives.
- Short tactical cues.
- Missing battle information that matters, such as unknown points or an unrevealed item.

Cards and retrieval summaries omit regulation-history paragraphs, archive dates, source names, URLs, sample narratives, and historical usage percentages. All indexed articles also omit Sources and review and Evidence and scope sections, scope/review metadata, and generic audit disclaimers. Compatibility with the selected format is checked during preparation. The model does not need to repeat that work. Full legal learnsets remain human reference material and are excluded from model cards.

Keep rules, triggers, targets, timing, conditions, exceptions, and specific unresolved interactions that could change an action. Omit statements about how a definition was imported or whether every callback was reviewed. Move text contains actual Champions PP; simulator-internal base PP and acquisition metadata stay offline. Ordinary critical-hit behavior belongs in the shared rule, rather than a repeated default `critRatio: 1` field. Unknown battle mechanics remain explicit: removing audit prose must not turn uncertainty into a claimed fact.

All builds are candidates for an unknown opponent. Put that convention once in the request instructions. Revealed moves, items, abilities, forms, and observed battle events override candidates. A recommended set is not evidence of its frequency; no usage probability is inferred from the order of candidate builds.

## Content files

| File | Use |
| --- | --- |
| [Jev index](data/jev-index.json) | Short identities and summaries for selecting relevant cards. |
| [Jev cards](data/jev-cards.json) | Selected text to load into model state. |
| [Pokémon sections](data/pokemon-sections.json) | Optional `identity`, `builds`, and `tactics` text keyed by canonical Pokémon IDs; section selection is not yet connected to an application. |
| [ID aliases](data/id-aliases.json) | Legacy profile IDs mapped to canonical Pokémon IDs, without duplicate profile cards. |
| [Competitive builds](data/competitive-builds.json) | Offline build records, original source options, source dates, validation, and profile selections. |
| [Stat priors](data/stat-priors.json) | Offline source distributions and provenance. |
| [Article maintenance records](data/article-maintenance.json) | Offline source, scope, and review material removed from indexed article text. |
| [Competitive sample](data/competitive-sample.json) | Original tournament observations and their evidence. |
| [Catalogue](catalog.json) and [graph](links.json) | Offline identity and relationship lookup; omit source metadata from runtime state. |

The bundle has 1,364 addressable cards, including 382 unified Pokémon/form profiles. There is no separate competitive-profile card kind. Load only relevant cards or sections and dependencies; a path or URL does not supply its content to Jev. Shared move, item, and ability definitions remain in their own cards.

## Stats and coherent builds

Stat order is HP/Atk/Def/SpA/SpD/Spe. **Species base stats are before stat points and nature.** Values such as `2/32/0/0/0/32` describe **allocated Champions stat points**, not traditional EVs. **Calculated build stats are after these points and nature, before stages, item effects, ability effects, weather, and other battle modifiers.** HP is maximum HP; current remaining HP comes from the live battle state.

For example, Jolly Aerodactyl with `2/32/0/0/0/32` points has calculated stats `157/157/85/72/95/200`. The same allocation and nature on Aerodactyl-Mega gives `157/187/105/81/115/222`. These are separate form-specific results, not values to which points should be added again.

Keep nature and points together when a source supplies their combination. Do not average different builds into a fictional typical Pokémon. A separate stat candidate does not fill the missing points of a published moveset. Nature and point marginals remain unpaired unless an explicitly curated candidate supplies that relationship.

For a Mega-capable starting form, distinguish its starting stats and ability from the Mega form. Preserve the item's transformation mapping. A Mega profile admits only builds that reach that form. Other reachable battle forms also retain their exact identities. Independent stat bounds span legal allocations and natures; all endpoints cannot generally coexist in one build, and they do not describe an expected spread.

## Current content

Version 0.7 covers all 293 selectable entries and 89 reachable battle forms in the pinned catalogue, with one page and card per entry. Cosmetic variants retain individual IDs and can share build knowledge only after their types, base stats, abilities, learnsets, weight, and gender data match. The article cleanup preserves all 1,364 cards and 33,495 graph edges; Pokémon content and build records are unchanged from version 0.6.

184 profiles have complete sourced or compatible-form build candidates. The build ledger contains 399 sourced records (90 Smogon recommendations, 306 player sets from 51 complete teams, and three Liberty Note examples), plus 27 explicit form derivatives. The remaining 198 profiles contain intrinsic abilities and independent stat bounds; moves, nature, and allocations remain unspecified, as do items unless the form requires a specific transformation item. Coverage is complete, while competitive build knowledge is uneven.

Missing build data does not establish low usage. Do not fabricate a common set, import a singles set as a doubles recommendation, or turn an arbitrary legal spread into an expected opponent build. Profiles with unspecified builds rely on observed information, their identity section, and relevant shared mechanics. Only selected profiles or sections enter a turn request.

See [competitive sources](competitive-sources.md) for the roles of other sources, [context-cleanup validation](evidence/context-cleanup-validation.json) for the latest content checks, and [unified-profile validation](evidence/unified-profile-validation.json) for the preceding migration checks. These presentation checks do not evaluate Jev calls, retrieval performance, or battle outcomes.
