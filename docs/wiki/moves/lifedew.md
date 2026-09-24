# Life Dew

`move:lifedew` · Heals the user and its allies by 1/4 their max HP.

## Definition

Each Pokemon on the user's side restores 1/4 of its maximum HP, rounded half up.

| Property | Resolved value |
| --- | --- |
| Type | Water |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | allies — The user and its allies as defined by the move. |
| PP in Champions | 12 |
| Flags | bypasssub, heal, snatch |

## Additional effect fields

```json
{
  "heal": [
    1,
    4
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Substitute](../articles/substitute.md), [Safeguard, healing, and healing prevention](../articles/healing-and-safeguard.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
