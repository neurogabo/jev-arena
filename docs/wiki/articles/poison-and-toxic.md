# Poison and bad poison

Poison and escalating bad poison, switch persistence and reset, immunity, healing, and damage prevention.

## Reference text

Include when poison, bad poison, Toxic, Toxic Spikes, or a poisoning secondary effect is relevant. Dependencies: major status, residual order, status immunity, hazard rules when applicable.

Ordinary poison deals 1/8 maximum HP at its poison residual event. Bad poison uses a counter: successive active poison events normally deal 1/16, 2/16, 3/16, and so forth, up to the engine's counter cap of 15. Round the base HP fraction before multiplying by the counter; rounding matters at HP thresholds.

Bad poison persists through ordinary switching, but its escalating counter resets for the next entry. Poison and bad poison are major statuses, so they normally cannot coexist with another major status. Poison and Steel types are immune to their initial application unless an applicable exception such as Corrosion overrides the type restriction.

Poison Heal changes ordinary poison damage into healing of 1/8 maximum HP at the relevant event. Magic Guard can prevent poison damage without curing the status. Do not infer that preventing one residual tick removes the underlying poison.

## Related articles

- [Other type-based immunities](type-immunities.md)
- [Statuses, volatile effects, and counters](statuses-and-counters.md)
- [Switching, pivots, and replacements](switches-and-replacements.md)
- [End-of-turn effects and fainting](residual-effects-and-fainting.md)
- [Entry hazards and hazard removal](hazards.md)

[Wiki home](../README.md) · [Directory](../directory.md)
