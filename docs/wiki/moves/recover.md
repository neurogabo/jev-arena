# Recover

`move:recover` · Heals the user by 50% of its max HP.

## Definition

The user restores 1/2 of its maximum HP, rounded half up.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 8 |
| Flags | heal, metronome, snatch |

## Additional effect fields

```json
{
  "heal": [
    1,
    2
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Safeguard, healing, and healing prevention](../articles/healing-and-safeguard.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
