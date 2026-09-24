# Wiki page contract

This describes the populated wiki's content conventions. It is not an SDK schema or an implemented ingestion pipeline. Version 0.7 contains unified Pokémon profiles, other resolved entity pages, curated interactions, and offline source records; see [population and validation](population-and-validation.md) for evidence boundaries.

## Common identity and navigation

Every page has a stable identifier, readable title, page kind, and short retrieval summary. The offline catalogue retains applicability, source references, and review status. Identifiers distinguish forms and game versions where necessary. A summary explains when the page is useful without claiming to contain every exception.

All indexed articles omit source/review and evidence/scope sections, scope/review/date metadata, and generic audit disclaimers. Provenance stays in the catalogue and [article maintenance records](data/article-maintenance.json), with collection and validation methods in maintainer documents. Pokémon pages combine identity and competitive knowledge. The future application sends selected [Jev card](data/jev-cards.json) text or selected Pokémon sections, not source ledgers. See the [model context contract](model-context.md). Content not supplied remains missing; empty values are not verified absence.

The fields below describe the full article record, not a required block of text in each page or model card. Only identity and battle-relevant content belong in retrieved text. Preserve specific mechanical uncertainties that could change an action, together with relevant conditions and exceptions.

| Field | Meaning |
| --- | --- |
| `id` | Stable page identity used by the catalogue and links. |
| `title` | Readable concept/entity name. |
| `kind` | Mechanic, Pokémon/form, move, ability, item, interaction, or project guide. Competitive knowledge is part of the Pokémon/form page. |
| `summary` | Short description that helps the retrieval model select the page. |
| `applies_to` | Game, simulator revision, and relevant format scope. |
| `body` | Complete explanation for the page's declared scope. |
| `links` | Related pages, with a relationship type and any necessary conditions. |
| `sources` | Source URL or local evidence, revision/date, and supporting location. |
| `review_status` | Draft, source-reviewed, simulator-tested, or other explicitly established status. |
| `open_questions` | Known uncertainty, missing coverage, and conflicting claims. |

## Page kinds

**Pokémon/form:** one canonical `pokemon:<id>` page and card for each admitted selectable entry or reachable battle form. It combines types, base statistics, form relationships, legal abilities, competitive build candidates, and tactical cues. The human-readable page also contains legal move references; the full learnset is excluded from model cards. A legal learnset is not a usage ranking. Individual battle HP, PP, item consumption, and stat stages remain in the turn state.

**Move:** type, category, resolved power/accuracy rules, actual Champions PP, priority, target meaning, relevant flags, primary and secondary effects, self effects, failure conditions, and dependencies. Omit simulator-internal base PP and acquisition metadata from page/card text. Omit a default `critRatio: 1` field when the shared critical-hit rule already supplies its meaning; keep elevated or guaranteed critical-hit behavior. Explain zero-power encoding only for moves where it affects interpretation, not alongside ordinary nonzero power values.

**Ability or item:** effect, trigger, subject, affected targets, suppression/bypass or consumption rules, and exceptions. Attach the ability or item's current state to the individual Pokémon in the battle snapshot.

**Mechanic:** a reusable concept such as grounding, flinching, protection, or spread damage. Split a broad family when one member can be retrieved independently without losing needed meaning. Keep dependencies attached.

**Interaction:** a specific relationship whose conditions are explicit. For example, a protection interaction must identify the kind of move, protected target, relevant flags, timing, and bypass conditions. Avoid unconditional edges derived from a sentence that was conditional.

The **competitive section** of a Pokémon/form page contains its role, coherent build candidates, nature, allocated Champions stat points, calculated stats, move alternatives, and tactical cues where available. Candidate builds are not revealed opponent facts. Collection period, population, source, sample size, and selection details belong to the offline build and source records. There is no separate competitive-profile page kind.

Label species base stats as **before stat points and nature**. Label allocations as **Champions stat points**, rather than traditional EVs. Label calculated build stats as **after allocated points and nature, before battle modifiers**. HP is maximum HP, not current remaining HP. Starting-form and transformed-form stats must name their exact form. Independent stat bounds describe possible values across legal points and natures; their endpoints do not generally form one jointly achievable build.

Stat candidates preserve exact form, Champions stat-point units, and nature/point jointness. Offline records retain regulation and provenance. Model cards omit regulation history, archive labels, source commentary, and unvalidated usage percentages. Keep battle-relevant uncertainty such as unknown points or an unrevealed item. For other articles, retain a specific unresolved interaction instead of a generic warning that callback execution or all pairwise interactions have not been reviewed.

## Graph relationships

Version 0.2 `links.json` preserves the original `see_also` links and adds typed relationships. `see_also` still supports editorial discovery without proving a mechanical interaction. Conditional claims have supporting sources and must retain their conditions when retrieved.

Relation types include:

| Relation | Additional information needed |
| --- | --- |
| `can_have` / `can_learn` | Legal form/game scope and resolved source. |
| `commonly_uses` / `commonly_paired_with` | Format, dates, population, frequency or qualitative evidence, and uncertainty. |
| `causes` / `modifies` | Trigger, affected value or effect, target, timing, and exceptions. |
| `blocks` / `bypasses` | Exact protected effect, actor/target conditions, timing, and limitations. |
| `requires_context` | Why the linked rule is necessary to interpret the source page. |
| `see_also` | Editorial relevance without an asserted mechanical or statistical relationship. |
| `has_type` | Default typing of this exact form; current types can differ. |
| `can_transform_into` | Legal starting form, required trigger/item, and remaining transformation eligibility. |
| `observed_uses` / `observed_paired_with` | Actual sample count, denominator, population, and sources; no claim of population-wide commonness. |
| `can_trigger` | A contingent event such as actual item consumption; not a guaranteed outcome from mere coexistence. |

Do not infer these semantic relations merely from names co-occurring or being linked on an external wiki. A link to Ghost typing can be a type property, an immunity condition, a historical exception, or incidental context.

## Progressive reading

The intended retrieval model first sees filtered entry identities and useful summaries, together with authorized battle state. It can select several entries. The future application then loads relevant card text and dependencies for the playing model; the complete offline catalogue is not a mandatory turn input.

[Pokémon sections](data/pokemon-sections.json) provides optional `identity`, `builds`, and `tactics` text keyed by canonical Pokémon IDs. These sections are content artifacts; section selection is not yet connected to an application. The [ID alias map](data/id-aliases.json) resolves legacy profile IDs to canonical Pokémon IDs. Aliases do not create extra catalog entries or duplicate model cards, and the obsolete `has_profile` relationship is removed.

A page should state enough context to stand on its own when retrieved. Cross-references can organize detail, but a bare identifier does not communicate a rule. The first version preserves broad articles where available; finer article boundaries and semantic edges remain editorial work.

## Admission checks

Before treating a new page as ready for battle retrieval, establish its Champions scope, resolve contradictory definitions, identify its supporting source, and include necessary dependencies. Before admitting a competitive prior, verify that its dataset describes the relevant format and that its fields mean what the profile claims.

Structural link checks establish navigability. Source review establishes a documented interpretation. Simulator tests and retrieval tests establish different, additional evidence. Keep those statuses distinct.

Coverage and depth are distinct. All 382 admitted Pokémon/forms have a unified profile: 184 have complete build candidates and 198 retain unspecified builds. A profile with no collected build still identifies the exact form, possible intrinsic abilities, independent stat bounds, and unknown set fields. Cosmetic forms may share candidate knowledge after structural equivalence checks. Mechanics-based bounds must never be labelled typical stat spreads. Migration checks are recorded in [unified-profile validation](evidence/unified-profile-validation.json).

The version 0.7 [context-cleanup checks](evidence/context-cleanup-validation.json) cover the removal of maintenance prose while retaining indexed identities, graph relationships, Pokémon content, build records, and specific mechanical uncertainties. Earlier reports remain snapshots of their respective versions.
