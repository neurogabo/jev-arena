# Electric Terrain

`move:electricterrain` · 5 turns. Grounded: +Electric power, can't sleep.

## Definition

For 5 turns, the terrain becomes Electric Terrain. During the effect, the power of Electric-type attacks made by grounded Pokemon is multiplied by 1.3 and grounded Pokemon cannot fall asleep; Pokemon already asleep do not wake up. Grounded Pokemon cannot become affected by Yawn or fall asleep from its effect. Camouflage transforms the user into an Electric type, Nature Power becomes Thunderbolt, and Secret Power has a 30% chance to cause paralysis. Fails if the current terrain is Electric Terrain.

| Property | Resolved value |
| --- | --- |
| Type | Electric |
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
  "terrain": "electricterrain"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Terrain framework](../articles/terrain-framework.md), [Electric Terrain](../articles/electric-terrain.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
