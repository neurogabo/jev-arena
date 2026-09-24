# Sandstorm

`move:sandstorm` · For 5 turns, a sandstorm rages. Rock: 1.5× SpD.

## Definition

For 5 turns, the weather becomes Sandstorm. At the end of each turn except the last, all active Pokemon lose 1/16 of their maximum HP, rounded down, unless they are a Ground, Rock, or Steel type, or have the Magic Guard, Overcoat, Sand Force, Sand Rush, or Sand Veil Abilities. During the effect, the Special Defense of Rock-type Pokemon is multiplied by 1.5 when taking damage from a special attack. Lasts for 8 turns if the user is holding Smooth Rock. Fails if the current weather is Sandstorm.

| Property | Resolved value |
| --- | --- |
| Type | Rock |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | all — The field/all active Pokémon as defined by the effect. |
| PP in Champions | 8 |
| Flags | metronome, wind |

## Additional effect fields

```json
{
  "weather": "Sandstorm"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Weather](../articles/weather.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
