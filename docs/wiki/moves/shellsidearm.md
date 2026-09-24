# Shell Side Arm

`move:shellsidearm` · 20% psn. Physical+contact if it would be stronger.

## Definition

Has a 20% chance to poison the target. This move becomes a physical attack that makes contact if the value of ((((2 × the user's level / 5 + 2) × 90 × X) / Y) / 50), where X is the user's Attack stat and Y is the target's Defense stat, is greater than the same value where X is the user's Special Attack stat and Y is the target's Special Defense stat. No stat modifiers other than stat stage changes are considered for this purpose. If the two values are equal, this move chooses a damage category at random.

| Property | Resolved value |
| --- | --- |
| Type | Poison |
| Category | Special |
| Listed base power | 90 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 12 |
| Flags | metronome, mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 20,
    "status": "psn"
  },
  "secondaries": [
    {
      "chance": 20,
      "status": "psn"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Poison and bad poison](../articles/poison-and-toxic.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
