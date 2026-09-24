# Aqua Ring

`move:aquaring` · User recovers 1/16 max HP per turn.

## Definition

The user has 1/16 of its maximum HP, rounded down, restored at the end of each turn while it remains active. If Big Root is held by the user, the HP recovered is 1.3× normal, rounded half down. If the user uses Baton Pass, the replacement will receive the healing effect.

| Property | Resolved value |
| --- | --- |
| Type | Water |
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
  "volatileStatus": "aquaring"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
