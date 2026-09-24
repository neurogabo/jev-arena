# Snowscape

`move:snowscape` · For 5 turns, snow falls. Ice: 1.5× Def.

## Definition

For 5 turns, the weather becomes Snow. During the effect, the Defense of Ice-type Pokemon is multiplied by 1.5 when taking damage from a physical attack. Lasts for 8 turns if the user is holding Icy Rock. Fails if the current weather is Snow.

| Property | Resolved value |
| --- | --- |
| Type | Ice |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | all — The field/all active Pokémon as defined by the effect. |
| PP in Champions | 8 |

## Additional effect fields

```json
{
  "weather": "snowscape"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Weather](../articles/weather.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
