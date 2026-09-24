# Spikes

`move:spikes` · Hurts grounded foes on switch-in. Max 3 layers.

## Definition

Sets up a hazard on the opposing side of the field, damaging each opposing Pokemon that switches in, unless it is a Flying-type Pokemon or has the Levitate Ability. Can be used up to three times before failing. Opponents lose 1/8 of their maximum HP with one layer, 1/6 of their maximum HP with two layers, and 1/4 of their maximum HP with three layers, all rounded down. Can be removed from the opposing side if any Pokemon uses Tidy Up, or if any opposing Pokemon uses Mortal Spin, Rapid Spin, or Defog successfully, or is hit by Defog.

| Property | Resolved value |
| --- | --- |
| Type | Ground |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | foeSide — The opposing side of the field. |
| PP in Champions | 20 |
| Flags | metronome, mustpressure, nonsky, reflectable |

## Additional effect fields

```json
{
  "sideCondition": "spikes"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Entry hazards and hazard removal](../articles/hazards.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
