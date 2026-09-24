# Sunny Day

`move:sunnyday` · For 5 turns, intense sunlight powers Fire moves.

## Definition

For 5 turns, the weather becomes Sun. The damage of Fire-type attacks is multiplied by 1.5 and the damage of Water-type attacks is multiplied by 0.5 during the effect. Lasts for 8 turns if the user is holding Heat Rock. Fails if the current weather is Sun.

| Property | Resolved value |
| --- | --- |
| Type | Fire |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | all — The field/all active Pokémon as defined by the effect. |
| PP in Champions | 8 |
| Flags | metronome |

## Additional effect fields

```json
{
  "weather": "sunnyday"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Weather](../articles/weather.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
