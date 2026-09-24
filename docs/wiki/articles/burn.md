# Burn

Burn damage, physical-attack penalty, immunity, and relevant damage or ability exceptions.

## Reference text

Include when a considered Pokémon is burned or a considered effect can cause burn. Dependencies: major status, physical damage, residual order, relevant immunity and ability definitions.

Burn normally causes damage equal to 1/16 of the affected Pokémon's maximum HP at its burn residual event. The damage uses the engine's integer handling. Protect does not prevent this residual damage.

Burn normally halves damage from the Pokémon's physical attacks. It does not simply replace the Pokémon's displayed Attack statistic with half its value. Critical hits do not normally remove this penalty. Guts prevents this physical-damage penalty while providing its own status-dependent Attack increase. Facade has its specific exception to the penalty.

Fire types cannot ordinarily be newly burned. Abilities, terrain, existing major status, Substitute, or another relevant protection can prevent application. Acquiring a burn-immune type does not itself remove an existing burn. Magic Guard prevents ordinary burn chip damage but does not generally erase the burn's other consequences.

## Related articles

- [Other type-based immunities](type-immunities.md)
- [Ordinary damage](ordinary-damage.md)
- [Statuses, volatile effects, and counters](statuses-and-counters.md)
- [End-of-turn effects and fainting](residual-effects-and-fainting.md)
- [Ability interactions](ability-interactions.md)

[Wiki home](../README.md) · [Directory](../directory.md)
