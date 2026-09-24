# Spread moves and ally damage

Multiple targets, spread damage reduction, separate hit outcomes, protection, and ally exposure.

## Reference text

A move targeting all adjacent Pokémon can damage the user's partner. A move targeting all adjacent foes ordinarily does not hit that partner. Consider each target's type, ability, item, protection, and current condition separately.

For ordinary damaging spread moves, the damage modifier is 0.75 when the engine identifies more than one target. This is a per-target damage reduction, not a division of one fixed damage pool among the targets.

The engine marks the move as a spread hit before resolving individual targets' protection and immunity checks. Consequently, one target protecting or being immune does not necessarily restore full single-target damage against the other target. A move with only one initial target can avoid the spread penalty. Special multi-target or multi-hit moves can use different rules.

Accuracy and other target-specific outcomes can differ between targets. One opponent being hit does not prove the other will be hit. Wide Guard protection depends on the move's target category, not simply on how many Pokémon happen to take damage.

## Related articles

- [Targets and field positions](targets-and-positions.md)
- [Ordinary damage](ordinary-damage.md)
- [Wide Guard and Quick Guard](wide-and-quick-guard.md)
- [Helping Hand and ally interaction](ally-interactions.md)

[Wiki home](../README.md) · [Directory](../directory.md)
