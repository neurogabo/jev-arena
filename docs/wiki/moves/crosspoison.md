# Cross Poison

`move:crosspoison` · High critical hit ratio. 10% chance to poison.

## Definition

Has a 10% chance to poison the target and a higher chance for a critical hit.

| Property | Resolved value |
| --- | --- |
| Type | Poison |
| Category | Physical |
| Listed base power | 70 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 20 |
| Flags | contact, metronome, mirror, protect, slicing |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 10,
    "status": "psn"
  },
  "secondaries": [
    {
      "chance": 10,
      "status": "psn"
    }
  ],
  "critRatio": 2
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Poison and bad poison](../articles/poison-and-toxic.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
