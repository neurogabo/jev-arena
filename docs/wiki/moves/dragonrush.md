# Dragon Rush

`move:dragonrush` · 20% chance to make the target flinch.

## Definition

Has a 20% chance to make the target flinch. Damage doubles and no accuracy check is done if the target has used Minimize while active.

| Property | Resolved value |
| --- | --- |
| Type | Dragon |
| Category | Physical |
| Listed base power | 100 |
| Accuracy | 75% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 12 |
| Flags | contact, metronome, minimize, mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 20,
    "volatileStatus": "flinch"
  },
  "secondaries": [
    {
      "chance": 20,
      "volatileStatus": "flinch"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
