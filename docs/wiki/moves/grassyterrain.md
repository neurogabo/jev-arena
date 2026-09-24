# Grassy Terrain

`move:grassyterrain` · 5 turns. Grounded: +Grass power, +1/16 max HP.

## Definition

For 5 turns, the terrain becomes Grassy Terrain. During the effect, the power of Grass-type attacks used by grounded Pokemon is multiplied by 1.3, the power of Bulldoze, Earthquake, and Magnitude used against grounded Pokemon is multiplied by 0.5, and grounded Pokemon have 1/16 of their maximum HP, rounded down, restored at the end of each turn, including the last turn. Camouflage transforms the user into a Grass type, Nature Power becomes Energy Ball, and Secret Power has a 30% chance to cause sleep. Fails if the current terrain is Grassy Terrain.

| Property | Resolved value |
| --- | --- |
| Type | Grass |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | all — The field/all active Pokémon as defined by the effect. |
| PP in Champions | 12 |
| Flags | metronome, nonsky |

## Additional effect fields

```json
{
  "terrain": "grassyterrain"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Terrain framework](../articles/terrain-framework.md), [Grassy Terrain](../articles/grassy-terrain.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
