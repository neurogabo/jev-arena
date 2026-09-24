# Statistics and stat stages

Unboosted versus effective statistics, stat-stage multipliers, stage limits, and Champions stat-point conventions.

## Reference text

HP describes current and maximum health. Attack and Defense normally govern physical damage; Special Attack and Special Defense normally govern special damage. Speed governs ordinary order within a priority bracket. Accuracy and evasion are separate battle stages rather than ordinary trained statistics.

The supplied stat fields must distinguish species base stats, actual unboosted battle stats, stat stages, and any already modified effective stats. Do not apply the same modifier twice. If the input gives an actual stat plus a stage, the stage still matters; if it explicitly gives an effective value that already includes that stage, use that fact.

Ordinary Attack, Defense, Special Attack, Special Defense, and Speed stages range from -6 to +6:

| Stage | Multiplier |
| --- | ---: |
| -6 | 1/4 |
| -5 | 2/7 |
| -4 | 1/3 |
| -3 | 2/5 |
| -2 | 1/2 |
| -1 | 2/3 |
| 0 | 1 |
| +1 | 3/2 |
| +2 | 2 |
| +3 | 5/2 |
| +4 | 3 |
| +5 | 7/2 |
| +6 | 4 |

Further changes are capped at the stage limits. Stat stages are multiplicative rather than flat additions. A one-stage increase has a different proportional effect at different starting stages. Ordinary switching resets stages unless an explicit transfer effect preserves them.

Abilities can prevent, reverse, double, reflect, or react to stat changes. Unaware changes which opposing stages matter during a calculation; it does not remove the stages. Haze actually resets stages. A critical hit ignores particular unfavorable stages for its own damage calculation, not every statistic change on the field.

Champions uses its own stat-point calculation. Do not reconstruct a Pokémon using another game's EV/IV assumptions. The application should supply the appropriate actual statistics, including relevant Mega form statistics.

## Related articles

- [Accuracy and evasion](accuracy-and-evasion.md)
- [Ordinary damage](ordinary-damage.md)
- [Critical hits](critical-hits.md)
- [Action order](action-order.md)

[Wiki home](../README.md) · [Directory](../directory.md)
