# Ancient Power

`move:ancientpower` · 10% chance to raise all stats by 1 (not acc/eva).

## Definition

Has a 10% chance to raise the user's Attack, Defense, Special Attack, Special Defense, and Speed by 1 stage.

| Property | Resolved value |
| --- | --- |
| Type | Rock |
| Category | Special |
| Listed base power | 60 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 8 |
| Flags | metronome, mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 10,
    "self": {
      "boosts": {
        "atk": 1,
        "def": 1,
        "spa": 1,
        "spd": 1,
        "spe": 1
      }
    }
  },
  "secondaries": [
    {
      "chance": 10,
      "self": {
        "boosts": {
          "atk": 1,
          "def": 1,
          "spa": 1,
          "spd": 1,
          "spe": 1
        }
      }
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
