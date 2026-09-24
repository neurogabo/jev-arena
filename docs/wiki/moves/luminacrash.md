# Lumina Crash

`move:luminacrash` · 100% chance to lower the target's Sp. Def by 2.

## Definition

Has a 100% chance to lower the target's Special Defense by 2 stages.

| Property | Resolved value |
| --- | --- |
| Type | Psychic |
| Category | Special |
| Listed base power | 80 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 12 |
| Flags | metronome, mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 100,
    "boosts": {
      "spd": -2
    }
  },
  "secondaries": [
    {
      "chance": 100,
      "boosts": {
        "spd": -2
      }
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
