# Trick Room

`move:trickroom` · Reverses Speed order within each priority bracket for five turns.

## Definition

For five turns including the setup turn, lower effective Speed acts before higher effective Speed within the same priority bracket. Using Trick Room again ends it. Its ordinary priority is -7. Champions compares negated Speed directly; the older extreme-Speed wraparound does not apply.

| Property | Resolved value |
| --- | --- |
| Type | Psychic |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | -7 |
| Target | all — The field/all active Pokémon as defined by the effect. |
| PP in Champions | 8 |
| Flags | metronome, mirror |

## Additional effect fields

```json
{
  "pseudoWeather": "trickroom"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Gravity, Trick Room, Tailwind, and other rooms](../articles/rooms-gravity-tailwind.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
