# Dire Claw

`move:direclaw` · 30% chance to sleep, poison, or paralyze target.

## Definition

Has a 30% chance to cause the target to either fall asleep, become poisoned, or become paralyzed.

| Property | Resolved value |
| --- | --- |
| Type | Poison |
| Category | Physical |
| Listed base power | 80 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 16 |
| Flags | contact, metronome, mirror, protect, slicing |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 30
  },
  "secondaries": [
    {
      "chance": 30
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
