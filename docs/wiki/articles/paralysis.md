# Paralysis — Champions

Champions paralysis Speed reduction and action-failure probability, including Quick Feet interaction.

## Reference text

Include when paralysis exists or can be inflicted. Dependencies: Speed, action order, major status, Quick Feet if relevant.

Paralysis normally halves the Pokémon's Speed after the other applicable Speed modifiers, with integer truncation. An active Quick Feet ability prevents this halving and applies its own status-dependent Speed modifier.

When the before-move paralysis check is reached, there is a **1/8 probability, or 12.5%, that the Pokémon cannot execute its move**. Quick Feet does not remove that failure check. An earlier event that prevents execution can stop the action before this check is reached.

Electric types cannot ordinarily be newly paralyzed. Ground immunity to an Electric attack such as Thunder Wave is an additional move/type interaction, not general immunity to every possible source of paralysis. Ordinary switching does not cure paralysis.

## Related articles

- [Action order](action-order.md)
- [Statistics and stat stages](statistics-and-stages.md)
- [Statuses, volatile effects, and counters](statuses-and-counters.md)
- [Ability interactions](ability-interactions.md)

[Wiki home](../README.md) · [Directory](../directory.md)
