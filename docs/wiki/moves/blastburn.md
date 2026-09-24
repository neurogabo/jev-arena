# Blast Burn

`move:blastburn` · User cannot move next turn.

## Definition

If this move is successful, the user must recharge on the following turn and cannot select a move.

| Property | Resolved value |
| --- | --- |
| Type | Fire |
| Category | Special |
| Listed base power | 150 |
| Accuracy | 90% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 8 |
| Flags | metronome, mirror, protect, recharge |

## Additional effect fields

```json
{
  "self": {
    "volatileStatus": "mustrecharge"
  }
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
