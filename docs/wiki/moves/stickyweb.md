# Sticky Web

`move:stickyweb` · Lowers Speed of grounded foes by 1 on switch-in.

## Definition

Sets up a hazard on the opposing side of the field, lowering the Speed by 1 stage of each opposing Pokemon that switches in, unless it is a Flying-type Pokemon or has the Levitate Ability. Fails if the effect is already active on the opposing side. Can be removed from the opposing side if any Pokemon uses Tidy Up, or if any opposing Pokemon uses Mortal Spin, Rapid Spin, or Defog successfully, or is hit by Defog.

| Property | Resolved value |
| --- | --- |
| Type | Bug |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | foeSide — The opposing side of the field. |
| PP in Champions | 20 |
| Flags | metronome, reflectable |

## Additional effect fields

```json
{
  "sideCondition": "stickyweb"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Entry hazards and hazard removal](../articles/hazards.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
