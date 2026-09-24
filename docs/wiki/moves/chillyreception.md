# Chilly Reception

`move:chillyreception` · Starts Snow. User switches out.

## Definition

For 5 turns, the weather becomes Snow. The user switches out even if it is trapped and is replaced immediately by a selected party member. The user does not switch out if there are no unfainted party members.

| Property | Resolved value |
| --- | --- |
| Type | Ice |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | all — The field/all active Pokémon as defined by the effect. |
| PP in Champions | 12 |

## Additional effect fields

```json
{
  "weather": "snowscape",
  "selfSwitch": true
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Switching, pivots, and replacements](../articles/switches-and-replacements.md), [Weather](../articles/weather.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
