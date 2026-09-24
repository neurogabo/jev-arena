# Fire Fang

`move:firefang` · 10% chance to burn. 10% chance to flinch.

## Definition

Has a 10% chance to burn the target and a 10% chance to make it flinch.

| Property | Resolved value |
| --- | --- |
| Type | Fire |
| Category | Physical |
| Listed base power | 65 |
| Accuracy | 95% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 16 |
| Flags | bite, contact, metronome, mirror, protect |

## Additional effect fields

```json
{
  "secondaries": [
    {
      "chance": 10,
      "status": "brn"
    },
    {
      "chance": 10,
      "volatileStatus": "flinch"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Burn](../articles/burn.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
