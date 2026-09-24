# Grav Apple

`move:gravapple` · Target: 100% -1 Def. During Gravity: 1.5× power.

## Definition

Has a 100% chance to lower the target's Defense by 1 stage. Power is multiplied by 1.5 during Gravity's effect.

| Property | Resolved value |
| --- | --- |
| Type | Grass |
| Category | Physical |
| Listed base power | 90 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 12 |
| Flags | mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 100,
    "boosts": {
      "def": -1
    }
  },
  "secondaries": [
    {
      "chance": 100,
      "boosts": {
        "def": -1
      }
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
