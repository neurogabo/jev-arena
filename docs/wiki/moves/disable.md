# Disable

`move:disable` · For 4 turns, disables the target's last move used.

## Definition

For 4 turns, the target's last move used becomes disabled. Fails if one of the target's moves is already disabled, if the target has not made a move, if the target no longer knows the move, or if the move was a Max or G-Max Move.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 20 |
| Flags | bypasssub, metronome, mirror, protect, reflectable |

## Additional effect fields

```json
{
  "volatileStatus": "disable"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md), [Substitute](../articles/substitute.md), [Taunt, Encore, Disable, Torment, and Imprison](../articles/move-restrictions.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
