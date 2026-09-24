# Arena knowledge

This is the knowledge snapshot used by the current arena: Pokémon Champions VGC Regulation M-C, with the engine revision pinned in the root `showdown.lock.json`. It contains 1,364 knowledge cards and their source references.

- [Catalog](catalog.json), [search index](data/jev-index.json), [model cards](data/jev-cards.json), and [relationships](links.json) support retrieval.
- [Pokémon profiles](pokemon/README.md), [moves](moves/README.md), [abilities](abilities/README.md), [items](items/README.md), [types](types/README.md), and [interactions](interactions/README.md) are human-readable references.
- [Source notes](sources.md), [competitive sources](competitive-sources.md), and [article maintenance](data/article-maintenance.json) preserve provenance separately from model text.
- [Model context contract](model-context.md) describes how observations differ from knowledge and hypotheses.

The app loads selected cards, not this entire directory into a single prompt. A learnset does not prove which moves an opponent knows; a sourced build is a hypothesis until revealed. Deterministic battle mechanics remain in the pinned engine. These records describe a fixed regulation snapshot, not a continuously updated rules service.

The source and generated bundles must remain consistent. Run the root `npm run verify-data` command after changes; the loader checks reviewed content hashes and team provenance. Pokémon profile pages are also used to verify reconstructed team stat points.

Imported Showdown data and descriptions retain their [MIT notice](evidence/showdown-LICENSE.txt). See the repository's [third-party notices](../../THIRD_PARTY_NOTICES.md) for other material.
