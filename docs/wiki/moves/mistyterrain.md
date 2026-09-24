# Misty Terrain

`move:mistyterrain` · 5 turns. Can't status,-Dragon power vs grounded.

## Definition

For 5 turns, the terrain becomes Misty Terrain. During the effect, the power of Dragon-type attacks used against grounded Pokemon is multiplied by 0.5 and grounded Pokemon cannot be inflicted with a non-volatile status condition nor confusion. Grounded Pokemon can become affected by Yawn but cannot fall asleep from its effect. Camouflage transforms the user into a Fairy type, Nature Power becomes Moonblast, and Secret Power has a 30% chance to lower Special Attack by 1 stage. Fails if the current terrain is Misty Terrain.

| Property | Resolved value |
| --- | --- |
| Type | Fairy |
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
  "terrain": "mistyterrain"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Terrain framework](../articles/terrain-framework.md), [Misty Terrain](../articles/misty-terrain.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
