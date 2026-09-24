# Competitive build sources

Reviewed 19 September 2026. This is a maintainer document; it is not model context.

## Sources incorporated

| Source | Contribution | Used in this edition |
| --- | --- | --- |
| [Smogon Champions Strategy Dex](https://www.smogon.com/dex/champions/pokemon/aerodactyl/) | Recommended builds, stat points, role explanations, alternative moves, and matchup reasoning. Recommendations do not establish usage rates. | 90 concrete build candidates from 57 source URLs (including form-specific pages). Source options remain in the build ledger. |
| [VGCPastes through MunchStats](https://www.munchstats.com/teams/) | Searchable player teams with filters for published spreads, reports, and replica codes; links to original player pastes. | 51 unique full teams, 306 exact sets, published 9–16 September; read the original Pokepaste contents. |
| [Liberty Note](https://liberty-note.com/) | Japanese doubles guides with complete builds, final statistics, point allocations, and tactical explanations. | Two [Sneasler builds](https://liberty-note.com/2026/07/23/sneasler-mb-double/) and one [Toxapex build](https://liberty-note.com/2026/08/12/toxapex-mb-double/), normalized to English. |
| [Limitless](https://play.limitlesstcg.com/) | Player-submitted tournament sheets and event context. | Existing collection of 15 checked teams and 90 sets; these sheets did not supply stat points. |
| [Pikalytics](https://www.pikalytics.com/) | Aggregated distributions and additional candidate point allocations. | Existing distributions retained offline; source percentages and historical commentary removed from model cards. |

## Additional sources examined

| Source | Useful contribution | Collection status |
| --- | --- | --- |
| [Pokémon Zone](https://www.pokemon-zone.com/champions/teams/) | Current M-C tournament teams, recurring movesets, partners, and form-specific build pages, including [Mega Salamence](https://www.pokemon-zone.com/champions/pokemon/salamence-mega-salamence/). | Verified. Its selected online dataset comes from Limitless, so it must not be counted as an independent tournament sample. Its visible nature/build summaries do not supply every full stat allocation. No additional profile rows imported here. |
| [Victory Road](https://victoryroad.pro/champions-replica-m-a/) | Curated teams, replica codes, pastes, and player reports when published. | Champions collection verified; the team-report navigation inspected led to the Scarlet/Violet archive. No claim of a verified current M-C report feed and no new rows imported here. |

Smogon and Liberty Note add curated competitive knowledge. Player pastes preserve actual complete team builds. Pikalytics and tournament aggregators help identify what appears frequently. These answer different questions and should not be merged into one unqualified frequency.

## Preparation choices

The [build ledger](data/competitive-builds.json) retains source URLs, original recommendation options, collection metadata, and profile-to-build IDs. Only factual set fields and short original role summaries are used; long analysis articles are not copied. In version 0.6, identity and competitive knowledge share one canonical `pokemon:<id>` page and model card. Source/review and evidence/scope sections are omitted from these Pokémon pages; this document and the source records retain provenance offline.

For Smogon, a concrete candidate chooses the first listed item, ability, and move per slot with its primary point allocation. Incineroar's nature is taken from the prose that explicitly pairs the spread with Careful; its displayed nature list uses a different order. Alternative recommendations remain distinct from measured joint frequencies. All imported sets pass the pinned Champions M-C validator, with additional starting-ability and transformation checks.

Profiles select one candidate from each available provider before filling a short list, prioritizing current builds within a provider. Extra point allocations remain separate from complete sets. Dates and format histories determine offline admission and priority; they are omitted from Jev cards and retrieval summaries.

Species base stats are shown before stat points and nature. Build allocations use Champions stat points; calculated stats include that allocation and nature, before battle modifiers. HP means maximum HP, and starting/transformed forms retain separate stat identities. This presentation does not change the underlying 399 sourced build records or 27 compatible-form derivatives.

Use the [validation report](evidence/competitive-build-validation.json) for executed checks. A legal, published set is a plausible hypothesis, not proof of current popularity or optimal play.

## Full roster coverage

[Coverage data](data/profile-coverage.json) lists all 382 unified Pokémon/form profiles and their build availability: 184 have complete candidates, while 198 currently have no sourced complete build. Their abilities and independent stat bounds come from the pinned simulator; no usage ranking or common moveset is invented. The [coverage validation](evidence/profile-coverage-validation.json) records the roster and expanded-build checks; [unified-profile validation](evidence/unified-profile-validation.json) records the version 0.6 migration checks.
