# Aura Wheel

`move:aurawheel` · Morpeko: Electric; Hangry: Dark; 100% +1 Spe.

## Definition

Has a 100% chance to raise the user's Speed by 1 stage. If the user is a Morpeko in Full Belly Mode, this move is Electric type. If the user is a Morpeko in Hangry Mode, this move is Dark type. This move cannot be used successfully unless the user's current form, while considering Transform, is Full Belly or Hangry Mode Morpeko.

| Property | Resolved value |
| --- | --- |
| Type | Electric |
| Category | Physical |
| Listed base power | 110 |
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
    "self": {
      "boosts": {
        "spe": 1
      }
    }
  },
  "secondaries": [
    {
      "chance": 100,
      "self": {
        "boosts": {
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
