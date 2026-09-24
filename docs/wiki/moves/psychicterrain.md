# Psychic Terrain

`move:psychicterrain` · 5 turns. Grounded: +Psychic power, priority-safe.

## Definition

For 5 turns, the terrain becomes Psychic Terrain. During the effect, the power of Psychic-type attacks made by grounded Pokemon is multiplied by 1.3 and grounded Pokemon cannot be hit by moves with priority greater than 0, unless the target is an ally. Camouflage transforms the user into a Psychic type, Nature Power becomes Psychic, and Secret Power has a 30% chance to lower the target's Speed by 1 stage. Fails if the current terrain is Psychic Terrain.

| Property | Resolved value |
| --- | --- |
| Type | Psychic |
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
  "terrain": "psychicterrain"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Terrain framework](../articles/terrain-framework.md), [Psychic Terrain](../articles/psychic-terrain.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
