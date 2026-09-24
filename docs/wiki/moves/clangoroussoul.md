# Clangorous Soul

`move:clangoroussoul` · User loses 33% of its max HP. +1 to all stats.

## Definition

Raises the user's Attack, Defense, Special Attack, Special Defense, and Speed by 1 stage in exchange for the user losing 33% of its maximum HP, rounded down. Fails if the user would faint or if its Attack, Defense, Special Attack, Special Defense, and Speed stat stages would not change.

| Property | Resolved value |
| --- | --- |
| Type | Dragon |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 8 |
| Flags | dance, snatch, sound |

## Additional effect fields

```json
{
  "boosts": {
    "atk": 1,
    "def": 1,
    "spa": 1,
    "spd": 1,
    "spe": 1
  }
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Statistics and stat stages](../articles/statistics-and-stages.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
