# Accuracy and evasion

Ordinary hit checks, accuracy and evasion stages, accuracy bypass, and special per-hit exceptions.

## Reference text

For an ordinary numeric-accuracy move, the user’s accuracy stage and the target’s evasion stage modify the hit check. The ordinary combined stage is accuracy minus evasion, limited to the range -6 to +6, subject to effects that ignore or modify either stage.

At combined stage `s`, the stage multiplier is `(3+s)/3` when `s` is nonnegative and `3/(3-s)` when `s` is negative. Thus +1 gives 4/3 and -1 gives 3/4. This is different from the ordinary stat-stage table.

Abilities, items, Gravity, weather, and move-specific rules can modify or bypass accuracy. Numeric 100% accuracy is not the same as bypassing accuracy checks: evasion or accuracy modifiers can still cause a normally 100%-accurate move to miss.

Bypassing accuracy does not automatically bypass a semi-invulnerable state, type immunity, protection, or a move's own failure condition. Multi-hit moves that perform additional accuracy checks need their particular per-hit rules. One-hit knockout moves also have their own accuracy and immunity rules.

## Related articles

- [Statistics and stat stages](statistics-and-stages.md)
- [Grounding and semi-invulnerability](grounding-and-hidden-states.md)
- [Gravity, Trick Room, Tailwind, and other rooms](rooms-gravity-tailwind.md)
- [Special damage and multi-hit attacks](special-damage-multihit.md)

[Wiki home](../README.md) · [Directory](../directory.md)
