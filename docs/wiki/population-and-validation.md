# Population method and evidence boundaries

Prepared 19 September 2026 for Champions M-C at Showdown `2ddfa0476f8207e12e204b1c69f7c7683b17633c`. See the [validation report](evidence/validation.json) for executed checks and counts.

The sections below retain the population history. For the current version 0.7 presentation and its checks, see [Battle-focused article text](#battle-focused-article-text-version-07) and the [context-cleanup validation report](evidence/context-cleanup-validation.json). Earlier reports describe the versions at which their checks ran.

## Entity population

The complete pinned Showdown source archive was obtained, locked dependencies installed in a temporary directory, and its standard build executed. Data was read through the format's `TeamValidator` and resolved Champions `Dex`, including `loadTextData()` for mod-resolved English text. File hashes and pinned URLs are in the [source manifest](evidence/source-manifest.json).

For selectable species/forms, species/ability rules and a concrete single-move set witness were validated. Each witness uses a neutral nature and one HP stat point solely to establish a legal example; it is not a competitive recommendation. Every listed move was checked individually through the format's move rules and `checkCanLearn` with fresh source state. This does not prove every arbitrary four-move/ability/item combination legal. Actual teams must still pass full validation.

Battle-only forms were distinguished from selectable forms. Their legal starting form must be present; required transformation items must be admitted. Terastallized forms and orphan battle forms inherited from unavailable starting species were excluded. This describes standard intrinsic form access, not every transient state that copying effects could construct. Items were resolved independently; an allowed item does not prove its named beneficiary is an allowed Pokémon.

The catalogue contains 382 Pokémon/forms, 511 moves (including fallback Struggle), 215 abilities, 166 items, and 18 types. Types use the simulator's numerical damage codes. Move PP uses the Champions calculation, not the generic main-series maximum-PP formula. Provenance includes base data and applicable mod/text records.

## English text and review

Entity descriptions are attributed imports from Showdown's MIT-licensed resolved text, accompanied by resolved numerical fields and flags. Exporting a callback's scalar fields is not a complete prose translation of its behavior. Sources and callback-name metadata support focused review. An empty object left after callback removal does not mean the effect is absent.

Two detected inherited-text conflicts were corrected in readable and structured definitions: Champions Trick Room reverses Speed without the old wraparound; Champions Run Away clears trapping flags. Original imported descriptions and correction sources remain in the data. Encore/Mental Herb, Mega Revival Blessing, and multi-hit threshold abilities retain explicit unresolved behavior checks.

Some inherited descriptions mention unavailable entities/mechanics as exceptions. Those names do not extend format legality. This population is not a line-by-line behavioral audit of every English description. Entity pages are marked `resolved-source-data`; curated interaction articles are `source-reviewed-not-battle-tested`. The original 51 mechanics/project articles were preserved byte-for-byte and retain their original review status.

## Competitive sample

Discovery used the first 20 high-placing team cards displayed on Pikalytics' M-C landing page on 19 September 2026. Their underlying Limitless team sheets and event pages were fetched individually. Event dates came from primary event pages. Species identifiers, ability, item, nature, and four moves were retained together. Pikalytics' displayed values remain available for comparison.

Admission requires primary M-C context, a suitable event population, exact valid starting-form abilities, and full team/set validation. The validator can silently normalize a Mega ability to a starting ability, so a separate check prevents that repair from becoming invented evidence. Unknown stat allocations use one HP point only inside validation; the published records retain `null`.

Fifteen teams and 90 set records were admitted, dated 9–11 September 2026, covering 38 starting Pokémon/forms. Five teams were excluded in full:

| Record | Reason |
| --- | --- |
| T06 | Starting-form ability inconsistencies, including Lycanroc/Tough Claws and Mega abilities listed for starting Froslass/Scovillain. |
| T07 | Off-meta event restrictions create a different sampling population. |
| T13 | Primary event scope did not explicitly establish M-C; its Floette record also failed validation. |
| T16 | The primary sheet's plain Floette identity failed validation; no silent substitution with Eternal Flower Floette. |
| T18 | Aerilate recorded for starting Salamence; the missing starting ability was not inferred. |

These exclusions mean “not admitted as unambiguous evidence here,” not a finding of player wrongdoing. Exact observations, URLs, hashes, and results are in [competitive-sample.json](data/competitive-sample.json).

Counts use admitted team-sheet records without weighting wins, placement, or event size. Several records can come from one event. Identical rosters can appear more than once and are not independent strategic designs. Move/item/ability counts use that Pokémon's record count as denominator. Partners describe the same six-member team, not chosen leads or the four brought. Coherent variants preserve ability, item, nature, and four moves together. No calibrated hidden-set probability, win rate, stat allocation, or population frequency was inferred.

Smogon's monthly index ended at August during collection, before M-C began, and was not used as substitute M-C data. This sample makes the profile layer concrete; a larger, fresher representative dataset is still needed before describing the current metagame distribution.

## Relationships and readiness

The graph contains `has_type`, individually checked `can_learn`, form-specific `can_have`, and conditional `can_transform_into` facts. Twenty interaction pages support explicitly conditioned `blocks`, `bypasses`, `modifies`, `causes`, and `can_trigger` claims. Retain actor/target state, timing, and exceptions when retrieving an edge.

`observed_uses` and `observed_paired_with` describe the sample. Small counts are not labelled `commonly_uses`. Profile retrieval cues are editorial interpretations of move functions, distinct from measured observations. Missing profiles remain missing.

Checks cover identity/path consistency, graph endpoints, entity references, source-set validation, sample denominators, preserved articles, and selected Champions invariants. They do not establish battle outcome correctness, exhaustive interactions, retrieval recall, model calibration, or playing strength. No battle execution tests or Jev evaluations were run.

## Refresh procedure

1. Record the new format ID and exact simulator commit; do not silently follow a moving latest branch.
2. Resolve data through that format's Dex/TeamValidator; repeat form/item availability and individual-move checks, then validate actual sourced teams.
3. Recheck changed mod callbacks against English text, preserve source hashes and attribution, and record corrections explicitly.
4. Refresh competitive records with dates, population, denominators, complete set identity, exclusions, and source links.
5. Rebuild references and repeat integrity checks. Promote interactions to battle-tested only after their tests run.

One-off content extraction helpers ran in a temporary directory outside the project. No application or TypeSafe integration code was added.

## Complete competitive builds (version 0.4)

102 additional complete build records were checked with the pinned M-C validator: 57 concrete selections from Smogon recommendations, 42 published sets in seven unique player teams, and three Liberty Note examples. Starting abilities were checked separately; Mega display forms were normalized only when they matched the held stone and its legal starting form. All seven complete teams passed team validation. Nature and stat points were retained together, and starting/after-Mega stats were calculated through the Champions implementation. Source options and selection details remain in the [build ledger](data/competitive-builds.json).

All 47 profile cards were rewritten; 43 have complete candidates. History, source narration, and unvalidated frequency claims are absent from the model-facing profiles and summaries. The new [competitive-build validation report](evidence/competitive-build-validation.json) supplements the structural and original-distribution checks. These checks do not establish retrieval quality, candidate coverage against live opponents, or action quality.

## Full roster profile coverage (version 0.5)

Every one of the 382 admitted entities now has a profile: 293 selectable entries and 89 battle forms. 184 have complete build candidates; 198 have mechanical baselines with unspecified builds. The source collection grew to 399 complete records, including 51 player teams; all those teams passed validation. 27 additional records explicitly transfer compatible builds to cosmetic variants or reachable non-Mega battle forms. These are not additional independent observations.

Two extraction issues surfaced during the full coverage check. Rotom's five appliance forms are selectable forms in their own right: their starting identity, validator witness, and signature move were corrected. Aura Guard was omitted because a starting-ability check excluded its Future flag, even though the pinned Lucario-Mega-Z definition grants it on transformation. Its resolved behavior is now represented, retaining the source TODO about ability bypass. Counts now include 216 abilities.

[Full coverage validation](evidence/profile-coverage-validation.json) checks profile-to-roster equality, source sets, transformations, equivalent forms, stat arithmetic, references, and original article preservation. A complete profile directory is not a claim of complete usage statistics or optimal action quality.

## Unified Pokémon profiles (version 0.6)

Identity and competitive knowledge now share one canonical `pokemon:<id>` page and model card for each of the 382 admitted Pokémon/forms: 293 selectable entries and 89 reachable battle forms. The catalogue contains 1,364 pages/cards after removing the separate competitive-profile entries. Current relationships are recorded in [links.json](links.json); legacy profile IDs resolve through the [ID alias map](data/id-aliases.json). The former profile directory points to the canonical Pokémon directory.

Build coverage is unchanged: 184 profiles have complete candidates and 198 have unspecified builds with mechanical baselines. All 399 sourced build records and 27 compatible-form derivatives remain in the offline ledger. This merge changes presentation and references, not the strength or frequency of the underlying competitive evidence.

Pokémon pages no longer include Sources and review or Evidence and scope sections. Source metadata remains in offline catalogue and evidence records. Full legal learnsets remain human reference material and are excluded from Jev cards. The optional [Pokémon section bundle](data/pokemon-sections.json) separates `identity`, `builds`, and `tactics` text under each canonical Pokémon ID; it is not yet connected to a retriever or application.

Stat labels distinguish species base stats before points and nature, allocated Champions stat points, and calculated stats after the allocation and nature but before battle modifiers. HP is maximum HP, not current remaining HP. Starting and transformed forms retain explicitly identified calculated stats. Independent bounds remain distinct from coherent complete spreads.

The [unified-profile validation report](evidence/unified-profile-validation.json) records migration checks for roster coverage, canonical references, card/section consistency, retained build records, stat presentation, and removed source boilerplate. Earlier validation reports remain historical records. These content checks do not establish retrieval quality, battle outcome correctness, or Jev playing strength.

## Battle-focused article text (version 0.7)

The 982 remaining non-Pokémon articles now follow the same presentation policy as Pokémon profiles: no Sources and review or Evidence and scope sections, no scope/review/date metadata, and no repeated disclaimer about Showdown text resolution or incomplete callback review. Source, scope, and review records remain in the [catalogue](catalog.json) and [article maintenance records](data/article-maintenance.json). Maintainer documents retain collection methods, attribution, and validation history.

The existing Jev cards already excluded the main audit footers, so removing those footers from Markdown pages alone does not reduce the existing card payload. Additional card changes remove simulator-internal base PP, move-acquisition metadata, redundant default critical-hit fields, and zero-power explanations attached to ordinary nonzero power values. Source-oriented wording is replaced with the corresponding battle fact where that fact matters. No token reduction percentage is inferred from the number of edited pages.

Specific mechanical uncertainty remains explicit: Encore with Mental Herb, Revival Blessing with Mega forms, Berserk and Anger Shell under multi-hit damage, Aura Guard bypass, and entry-hazard ordering. Conditions, exceptions, and cross-referenced mechanics remain part of battle-reading text. Audit uncertainty is kept in maintenance records; an unresolved battle interaction is not silently presented as settled.

The catalogue still contains 1,364 cards, including 382 unified Pokémon/forms, and the graph still contains 33,495 edges. Pokémon content and all 426 build records are unchanged. This edition changes article and card presentation, without implementing or modifying a retriever or TypeSafe API integration.

The [context-cleanup validation report](evidence/context-cleanup-validation.json) records the executed presentation and preservation checks. Historical article-preservation results describe earlier editions; the version 0.7 cleanup intentionally changes the affected article text. These checks do not establish exhaustive mechanical accuracy, retrieval quality, or Jev playing strength.
