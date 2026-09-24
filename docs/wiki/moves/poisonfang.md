# Poison Fang

`move:poisonfang` · 50% chance to badly poison the target.

## Definition

Has a 50% chance to badly poison the target.

| Property | Resolved value |
| --- | --- |
| Type | Poison |
| Category | Physical |
| Listed base power | 50 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 16 |
| Flags | bite, contact, metronome, mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 50,
    "status": "tox"
  },
  "secondaries": [
    {
      "chance": 50,
      "status": "tox"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Poison and bad poison](../articles/poison-and-toxic.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
