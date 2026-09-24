# Charge

`move:charge` · +1 SpD, user's next Electric move 2× power.

## Definition

Raises the user's Special Defense by 1 stage. The user's next Electric-type attack will have its power doubled; the effect ends when the user is no longer active, or after the user attempts to use any Electric-type move besides Charge, even if it is not successful.

| Property | Resolved value |
| --- | --- |
| Type | Electric |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 20 |
| Flags | metronome, snatch |

## Additional effect fields

```json
{
  "boosts": {
    "spd": 1
  },
  "volatileStatus": "charge"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Statistics and stat stages](../articles/statistics-and-stages.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
