# Blizzard

`move:blizzard` · 10% chance to freeze foe(s). Can't miss in Snow.

## Definition

Has a 10% chance to freeze the target. If the weather is Snow, this move does not check accuracy.

| Property | Resolved value |
| --- | --- |
| Type | Ice |
| Category | Special |
| Listed base power | 110 |
| Accuracy | 70% before applicable modifiers |
| Base priority | 0 |
| Target | allAdjacentFoes — All adjacent opposing Pokémon; spread targeting. |
| PP in Champions | 8 |
| Flags | metronome, mirror, protect, wind |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 10,
    "status": "frz"
  },
  "secondaries": [
    {
      "chance": 10,
      "status": "frz"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Spread moves and ally damage](../articles/spread-and-ally-damage.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Freeze — Champions](../articles/freeze.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
