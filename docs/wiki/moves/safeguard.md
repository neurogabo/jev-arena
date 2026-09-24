# Safeguard

`move:safeguard` · For 5 turns, protects user's party from status.

## Definition

For 5 turns, the user and its party members cannot have non-volatile status conditions or confusion inflicted on them by other Pokemon. Pokemon on the user's side cannot become affected by Yawn but can fall asleep from its effect. It is removed from the user's side if the user or an ally is successfully hit by Defog. Fails if the effect is already active on the user's side.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | allySide — The user’s side of the field. |
| PP in Champions | 20 |
| Flags | metronome, snatch |

## Additional effect fields

```json
{
  "sideCondition": "safeguard"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
