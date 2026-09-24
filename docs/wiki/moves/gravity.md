# Gravity

`move:gravity` · 5 turns: no Ground immunities, 1.67× accuracy.

## Definition

For 5 turns, the evasiveness of all active Pokemon is multiplied by 0.6. At the time of use, Bounce, Fly, Magnet Rise, Sky Drop, and Telekinesis end immediately for all active Pokemon. During the effect, Bounce, Fly, Flying Press, High Jump Kick, Jump Kick, Magnet Rise, Sky Drop, Splash, and Telekinesis are prevented from being used by all active Pokemon. Ground-type attacks, Spikes, Toxic Spikes, Sticky Web, and the Arena Trap Ability can affect Flying types or Pokemon with the Levitate Ability. Fails if this move is already in effect.

| Property | Resolved value |
| --- | --- |
| Type | Psychic |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | all — The field/all active Pokémon as defined by the effect. |
| PP in Champions | 8 |
| Flags | metronome, nonsky |

## Additional effect fields

```json
{
  "pseudoWeather": "gravity"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Gravity, Trick Room, Tailwind, and other rooms](../articles/rooms-gravity-tailwind.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
