# Toxic Spikes

`move:toxicspikes` · Poisons grounded foes on switch-in. Max 2 layers.

## Definition

Sets up a hazard on the opposing side of the field, poisoning each opposing Pokemon that switches in, unless it is a Flying-type Pokemon or has the Levitate Ability. Can be used up to two times before failing. Opposing Pokemon become poisoned with one layer and badly poisoned with two layers. Can be removed from the opposing side if any Pokemon uses Tidy Up, or if any opposing Pokemon uses Mortal Spin, Rapid Spin, or Defog successfully, is hit by Defog, or a grounded Poison-type Pokemon switches in. Safeguard prevents the opposing party from being poisoned on switch-in, but a substitute does not.

| Property | Resolved value |
| --- | --- |
| Type | Poison |
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
  "sideCondition": "toxicspikes"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Entry hazards and hazard removal](../articles/hazards.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
