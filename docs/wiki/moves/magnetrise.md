# Magnet Rise

`move:magnetrise` · For 5 turns, the user has immunity to Ground.

## Definition

For 5 turns, the user is immune to Ground-type attacks and the effects of Spikes, Toxic Spikes, Sticky Web, and the Arena Trap Ability as long as it remains active. If the user uses Baton Pass, the replacement will gain the effect. Ingrain, Smack Down, Thousand Arrows, and Iron Ball override this move if the user is under any of their effects. Fails if the user is already under this effect or the effects of Ingrain, Smack Down, or Thousand Arrows.

| Property | Resolved value |
| --- | --- |
| Type | Electric |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 12 |
| Flags | gravity, metronome, snatch |

## Additional effect fields

```json
{
  "volatileStatus": "magnetrise"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
