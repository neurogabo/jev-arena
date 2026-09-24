# Muddy Water

`move:muddywater` · 30% chance to lower the foe(s) accuracy by 1.

## Definition

Has a 30% chance to lower the target's accuracy by 1 stage.

| Property | Resolved value |
| --- | --- |
| Type | Water |
| Category | Special |
| Listed base power | 90 |
| Accuracy | 85% before applicable modifiers |
| Base priority | 0 |
| Target | allAdjacentFoes — All adjacent opposing Pokémon; spread targeting. |
| PP in Champions | 12 |
| Flags | metronome, mirror, nonsky, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 30,
    "boosts": {
      "accuracy": -1
    }
  },
  "secondaries": [
    {
      "chance": 30,
      "boosts": {
        "accuracy": -1
      }
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Spread moves and ally damage](../articles/spread-and-ally-damage.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
