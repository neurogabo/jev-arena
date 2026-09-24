# Gravity, Trick Room, Tailwind, and other rooms

Gravity, Trick Room, Tailwind, Wonder Room, and Magic Room: duration, ordering, grounding, and suppression.

## Reference text

Include the specific effects present or producible. Dependencies: Speed, grounding, accuracy, duration.

**Gravity:** Normally lasts five turns. It grounds applicable Pokémon and increases ordinary move accuracy by a factor of 5/3 through the accuracy system. It prevents specified airborne moves and ends certain airborne states. It does not remove every unrelated immunity or protection. The exact list of gravity-blocked moves must come from the considered move definitions.

**Trick Room:** Normally lasts five turns including its setup turn. It reverses the effective-Speed comparison within each priority bracket. Using it again while active ends the effect. Its own ordinary priority is -7. Champions uses a straightforward reversed Speed comparison rather than the old extreme-Speed wraparound.

**Tailwind:** Doubles the Speed of Pokémon on the user's side for four turns including setup. The effect belongs to the side and persists if the setter switches or faints. It can change the order of actions remaining in the current turn. Under Trick Room, becoming faster can make a Pokémon move later within its priority bracket.

**Wonder Room:** Temporarily exchanges the defensive-stat roles specified by its implementation for five turns. It does not simply exchange the displayed Defense and Special Defense stage counters. Use the supplied effective defensive information for unusual stat-substitution attacks. A second use ends it.

**Magic Room:** Normally suppresses the ordinary effects of held items for five turns. Suppression is not consumption or removal. Item-dependent form changes have special handling. A second use ends it. The presence of a held item alone is therefore insufficient to assume that its ordinary battle effect currently applies.

## Related articles

- [Action order](action-order.md)
- [Statistics and stat stages](statistics-and-stages.md)
- [Accuracy and evasion](accuracy-and-evasion.md)
- [Grounding and semi-invulnerability](grounding-and-hidden-states.md)
- [Abilities and held items](ability-and-item-state.md)

[Wiki home](../README.md) · [Directory](../directory.md)
