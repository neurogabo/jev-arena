# Magic Room

`move:magicroom` · For 5 turns, all held items have no effect.

## Definition

For 5 turns, the held items of all active Pokemon have no effect. An item's effect of causing forme changes is unaffected, but any other effects from such items are negated. During the effect, Fling and Natural Gift are prevented from being used by all active Pokemon. If this move is used during the effect, the effect ends.

| Property | Resolved value |
| --- | --- |
| Type | Psychic |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | all — The field/all active Pokémon as defined by the effect. |
| PP in Champions | 12 |
| Flags | metronome, mirror |

## Additional effect fields

```json
{
  "pseudoWeather": "magicroom"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Gravity, Trick Room, Tailwind, and other rooms](../articles/rooms-gravity-tailwind.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
