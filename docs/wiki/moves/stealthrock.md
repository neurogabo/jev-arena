# Stealth Rock

`move:stealthrock` · Hurts foes on switch-in. Factors Rock weakness.

## Definition

Sets up a hazard on the opposing side of the field, damaging each opposing Pokemon that switches in. Fails if the effect is already active on the opposing side. Foes lose 1/32, 1/16, 1/8, 1/4, or 1/2 of their maximum HP, rounded down, based on their weakness to the Rock type; 0.25×, 0.5×, neutral, 2×, or 4×, respectively. Can be removed from the opposing side if any Pokemon uses Tidy Up, or if any opposing Pokemon uses Mortal Spin, Rapid Spin, or Defog successfully, or is hit by Defog.

| Property | Resolved value |
| --- | --- |
| Type | Rock |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | foeSide — The opposing side of the field. |
| PP in Champions | 20 |
| Flags | metronome, mustpressure, reflectable |

## Additional effect fields

```json
{
  "sideCondition": "stealthrock"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Entry hazards and hazard removal](../articles/hazards.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
