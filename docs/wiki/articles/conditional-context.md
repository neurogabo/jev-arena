# Using the conditional library

When to load shared definitions, include dependencies, deduplicate rules, and preserve individual Pokémon state.

## Reference text

Apply a conditional entry only when its triggering effect is present or can arise from a considered action or opponent hypothesis. A reference to an ability or item does not assert that a particular Pokémon possesses it.

Include the full chain of needed definitions. Fake Out requires its own move data, priority, flinching, protection, and the relevant immunity rules. Psychic Terrain additionally requires grounding. A possible switch to a terrain-setting Pokémon can make that terrain relevant before it is on the field.

Use one shared definition per entity or mechanic. Per-Pokémon PP, current ability state, item state, counters, and restrictions remain attached to that individual Pokémon. Two Pokémon knowing Protect share the definition but do not share PP or consecutive-use counters.

This context provides rules and observed information for judgment. Exact damage outcomes, future opponent commands, and unrevealed random outcomes are not supplied unless explicitly identified as such in the current state. The selected action should remain a judgment under those information limits.

## Related articles

- [Decision and information boundaries](decision-boundaries.md)
- [Move properties](move-properties.md)
- [Statuses, volatile effects, and counters](statuses-and-counters.md)
- [Abilities and held items](ability-and-item-state.md)

[Wiki home](../README.md) · [Directory](../directory.md)
