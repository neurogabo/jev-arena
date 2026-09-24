# Crush Claw

`move:crushclaw` · 50% chance to lower the target's Defense by 1.

## Definition

Has a 50% chance to lower the target's Defense by 1 stage.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Physical |
| Listed base power | 75 |
| Accuracy | 95% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 12 |
| Flags | contact, metronome, mirror, protect, slicing |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 50,
    "boosts": {
      "def": -1
    }
  },
  "secondaries": [
    {
      "chance": 50,
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
