# Tailwind

`move:tailwind` · For 4 turns, allies' Speed is doubled.

## Definition

For 4 turns, the user and its party members have their Speed doubled. Fails if this move is already in effect for the user's side.

| Property | Resolved value |
| --- | --- |
| Type | Flying |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | allySide — The user’s side of the field. |
| PP in Champions | 16 |
| Flags | metronome, snatch, wind |

## Additional effect fields

```json
{
  "sideCondition": "tailwind"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Gravity, Trick Room, Tailwind, and other rooms](../articles/rooms-gravity-tailwind.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
