# Existing references and their role in this wiki

Reviewed and populated 19 September 2026. This remains a targeted source review, not an audit of every external article or statistic. Version 0.2 adds a complete resolved entity catalogue at the pinned simulator revision, 20 curated interactions, and 38 profiles from a selected primary-source tournament sample. See [population and validation](population-and-validation.md).

## Bulbapedia: a strong existing article and navigation structure

Bulbapedia already separates entities from general mechanics, supplies infoboxes and section headings, and links terms to related pages. Representative pages examined include [Protect](https://bulbapedia.bulbagarden.net/wiki/Protect_(move)), [Fake Out](https://bulbapedia.bulbagarden.net/wiki/Fake_Out_(move)), [Protection](https://bulbapedia.bulbagarden.net/wiki/Protection), [Intimidate](https://bulbapedia.bulbagarden.net/wiki/Intimidate_(Ability)), [Psychic Terrain](https://bulbapedia.bulbagarden.net/wiki/Psychic_Terrain_(move)), and [Pokémon Champions](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Champions).

The sampled move pages include structured attributes, explanations, game-specific changes, learnsets, and links to related mechanics. They also contain historical rules and material about other games or media. A page is therefore a useful reference container, but not automatically a suitable unit to send in full to the battle model.

Protect illustrates the version-selection problem: its general infobox lists 10 PP with a maximum of 16, while its Champions section says 8 PP. The local draft's Showdown explanation distinguishes the internal base-PP value from the Champions PP calculation. A section extractor must resolve that context rather than flatten every number into one record. [Protect's Champions section](https://bulbapedia.bulbagarden.net/wiki/Protect_(move)#Pok%C3%A9mon_Champions).

The page structure is worth adopting: one recognizable entity per page, shared mechanics pages, cross-references, and game-specific scope. For retrieval, add section identifiers, concise selection summaries, and explicit applicability. Do not turn every hyperlink into a causal relationship: an article can link to an older game, a source, a related concept, or an exception.

Bulbapedia's [copyright statement](https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:Copyrights) lists Attribution-NonCommercial-ShareAlike terms for its original content. This edition links to those pages and uses our existing project prose. Any later text import must preserve the applicable source, attribution, and reuse terms. No bulk-download or API capability was established by this review.

## Pokémon Showdown: the executable reference for this demo

The demo runs against Showdown, so its pinned implementation determines the behavior the bot will encounter. Start with the [M-C format](https://github.com/smogon/pokemon-showdown/blob/2ddfa0476f8207e12e204b1c69f7c7683b17633c/config/formats.ts#L288), resolve the Champions mod and inherited data, and inspect engine callbacks where necessary.

Use Showdown for stable identifiers, format legality, entity values, move flags, and simulator behavior. Retain the commit and supporting file/section with each rule. Conflicts with external descriptions should be recorded; do not merge inconsistent mechanics into one confident statement. A claim about this simulator is distinct from a claim proven on the retail game.

The article catalogue retains source references for the migrated mechanics articles. Those original rules were not all re-audited. Entity population executed the pinned repository's build, format validator, resolved Dex, and English-text resolver. Source hashes are in the [manifest](evidence/source-manifest.json); Showdown's [MIT license](evidence/showdown-LICENSE.txt) is retained for imported data and descriptions. Data extraction, prose review, and behavior tests remain distinct evidence levels.

## Smogon: format-specific reference and competitive analysis

The [Champions VGC 2026 M-C format page](https://www.smogon.com/dex/champions/formats/vgc26-regulation-m-c/) identifies the matching Showdown format and links competitive resources and available analyses. There is also a [Champions Protect entry](https://www.smogon.com/dex/champions/moves/protect/).

This is a useful model for keeping strategy tied to a particular format. A strategy write-up can explain a role or coherent set, while a move definition explains the mechanics. Their evidence types differ. Analysis coverage is not assumed complete; this review did not validate every species entry. Some Dex pages exposed little body text through the text browser, so bulk extraction remains unverified.

## Pikalytics: candidates for dated competitive profiles

The [Pikalytics main page](https://www.pikalytics.com/) currently identifies Champions Regulation M-C and exposes usage/build information, team lists, and tournament links. Its [tournament pages](https://www.pikalytics.com/tournaments?page=2) include recent M-C events.

These are candidates for the profile layer. Before importing percentages, identify the population, date range, format, sample size when available, and the meaning of each field. Keep ladder and tournament evidence distinguishable. A marginal move frequency is not the frequency of a complete set, and a recorded battle ability or transformed form is not automatically the selected starting ability or form.

Population used 20 displayed team cards for discovery, then read their original Limitless team sheets and event pages. Fifteen teams passed scope and identity/legality checks, giving 90 records for 38 Pokémon profiles. Events are dated 9–11 September 2026. Five teams were excluded with reasons recorded in [the sample](data/competitive-sample.json). These are descriptive counts of a small selected sample; the landing page's aggregate usage percentages were not imported as a validated population dataset. A stable bulk API and the site's aggregate methodology remain unverified.

The [Smogon monthly statistics index](https://www.smogon.com/stats/) ended at August when checked. Those pre-M-C statistics were not substituted for the current format. The curated sample needs broader and more recent coverage before supporting metagame-wide priors.

## Recommended source assignment

| Wiki content | Main evidence | Supporting evidence |
| --- | --- | --- |
| Simulator mechanics | Pinned Showdown implementation | Bulbapedia's applicable game-specific explanations |
| Legal entities and forms | Selected Showdown format and resolved data | Official regulation announcements |
| Readable explanations and navigation | Original summaries linked to implementation | Bulbapedia's entity/mechanic page structure |
| Common sets and usage | Dated, format-matched datasets or team sheets | Pikalytics and linked tournaments after field validation |
| Roles and tactical interpretations | Format-specific analysis with a stated source | Smogon analyses and clearly labelled project hypotheses |

This assignment is a project design choice. It does not mean one source is correct about every category or that fan references are official game specifications.

## TypeSafe connection

The [TypeSafe skill-suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion) provides a useful pattern: inspect short catalogue descriptions, then load more detail for selected entries. It does not prove that the same ranking will retrieve every necessary Pokémon rule. The [API reference](https://docs.typesafe.ai/api) keeps state separate from the questions that judge it.

For this wiki, the catalogue and article text are separate artifacts. We retain readable entry identifiers and actual content; the application will resolve paths before calling Jev. The catalogue is not a substitute for rules, and knowledge selection remains separate from the playing model's final action choice.

## Remaining evidence work

Version 0.3 additionally checks Pikalytics' public species-data endpoint, discovered from its own frontend. The [stat-prior dataset](data/stat-priors.json) retains source URLs, response hashes, exact form/format identity, archive metadata, exclusions, and calculated statistics. It contains 1,263 spread rows across 49 species/format records. There are no current M-C spreads in the checked responses; M-B/M-A fallbacks remain historical. The [model context contract](model-context.md) separates this provenance from Jev's selected text.

1. Extend the competitive sample and preserve population/date distinctions; keep profiles missing where there is no admitted evidence.
2. Review inherited English descriptions against relevant callback exceptions, especially detected conflicts and upstream TODOs.
3. Expand conditional interactions as concrete battle cases require them; current coverage is not every possible pair.
4. Split broad mechanics articles where retrieval evaluation shows unnecessary context loading or missing dependencies.
5. Run focused battle tests, then retrieval and Jev decision evaluations. Structural/data checks alone do not establish playing strength.

The requested content layers are populated for the first edition. Further evaluation improves their evidence and retrieval coverage; it is distinct from simply having pages in the catalogue.

## Competitive source expansion (version 0.4)

See [competitive sources](competitive-sources.md) for Smogon, VGCPastes/MunchStats, Liberty Note, Pokemon Zone, and Victory Road coverage. Complete build fields and provenance are in [competitive-builds.json](data/competitive-builds.json). Source history stays outside model cards.
