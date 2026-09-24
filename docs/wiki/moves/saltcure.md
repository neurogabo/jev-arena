# Salt Cure

`move:saltcure` · Deals 1/16 max HP each turn; 1/8 on Steel, Water.

## Definition

Causes damage to the target equal to 1/16 of its maximum HP (1/8 if the target is Steel or Water type), rounded down, at the end of each turn during effect. This effect ends when the target is no longer active.

| Property | Resolved value |
| --- | --- |
| Type | Rock |
| Category | Physical |
| Listed base power | 40 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 16 |
| Flags | mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 100,
    "volatileStatus": "saltcure"
  },
  "secondaries": [
    {
      "chance": 100,
      "volatileStatus": "saltcure"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Leech Seed, binding, Salt Cure, and Curse](../articles/persistent-damage.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
