# Substitute

Substitute HP cost, interception, status protection, bypass, multi-hit behavior, and switching or transfer.

## Reference text

Include when a Substitute exists or a considered Pokémon can create or transfer one. Dependencies: current HP, multi-hit attacks, sound and bypass tags, Infiltrator, residual effects.

Substitute costs one quarter of the user's maximum HP, rounded down, and creates a separate damage buffer with that HP. The move fails if a substitute already exists or the user cannot pay the required cost and remain alive. The substitute does not have a separate type chart; the protected Pokémon's relevant damage calculation still governs attacks against it.

An eligible attack damages the substitute instead of the Pokémon. Excess damage from the hit that breaks it does not overflow onto the Pokémon, but later hits of the same multi-hit attack can hit the Pokémon. Many opposing status effects and stat reductions are blocked while the substitute intercepts the move.

Moves with an applicable bypass property, including relevant sound moves, and attacks using Infiltrator can bypass it. Do not treat every field-wide or self-directed effect as a move aimed through the substitute. Existing weather/status/residual effects still affect the Pokémon according to their own rules.

Ordinary switching removes the substitute. Baton Pass can transfer it with its remaining HP. Successfully creating a substitute removes an ordinary binding volatile. Hitting a substitute is not necessarily the same as triggering an item that requires the holder itself to take damage.

## Related articles

- [Ordinary damage](ordinary-damage.md)
- [Damage, contact, and secondary effects](damage-contact-secondary.md)
- [Switching, pivots, and replacements](switches-and-replacements.md)
- [Leech Seed, binding, Salt Cure, and Curse](persistent-damage.md)
- [Special damage and multi-hit attacks](special-damage-multihit.md)

[Wiki home](../README.md) · [Directory](../directory.md)
