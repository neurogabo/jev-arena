# Dynamic Punch

`move:dynamicpunch` · 100% chance to confuse the target.

## Definition

Has a 100% chance to confuse the target.

| Property | Resolved value |
| --- | --- |
| Type | Fighting |
| Category | Physical |
| Listed base power | 100 |
| Accuracy | 50% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 8 |
| Flags | contact, metronome, mirror, protect, punch |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 100,
    "volatileStatus": "confusion"
  },
  "secondaries": [
    {
      "chance": 100,
      "volatileStatus": "confusion"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
