# No Retreat

`move:noretreat` · Raises all stats by 1 (not acc/eva). Traps user.

## Definition

Raises the user's Attack, Defense, Special Attack, Special Defense, and Speed by 1 stage, but it becomes prevented from switching out. The user can still switch out if it uses Baton Pass, Flip Turn, Parting Shot, Teleport, U-turn, or Volt Switch. Fails if the user has already been prevented from switching by this effect.

| Property | Resolved value |
| --- | --- |
| Type | Fighting |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 8 |
| Flags | metronome, snatch |

## Additional effect fields

```json
{
  "boosts": {
    "atk": 1,
    "def": 1,
    "spa": 1,
    "spd": 1,
    "spe": 1
  },
  "volatileStatus": "noretreat"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Statistics and stat stages](../articles/statistics-and-stages.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
