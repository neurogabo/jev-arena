# Shell Smash

`move:shellsmash` · Lowers Def, SpD by 1; raises Atk, SpA, Spe by 2.

## Definition

Lowers the user's Defense and Special Defense by 1 stage. Raises the user's Attack, Special Attack, and Speed by 2 stages.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 16 |
| Flags | metronome, snatch |

## Additional effect fields

```json
{
  "boosts": {
    "def": -1,
    "spd": -1,
    "atk": 2,
    "spa": 2,
    "spe": 2
  }
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Statistics and stat stages](../articles/statistics-and-stages.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
