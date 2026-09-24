# Heat Wave

`move:heatwave` · 10% chance to burn the foe(s).

## Definition

Has a 10% chance to burn the target.

| Property | Resolved value |
| --- | --- |
| Type | Fire |
| Category | Special |
| Listed base power | 95 |
| Accuracy | 90% before applicable modifiers |
| Base priority | 0 |
| Target | allAdjacentFoes — All adjacent opposing Pokémon; spread targeting. |
| PP in Champions | 12 |
| Flags | metronome, mirror, protect, wind |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 10,
    "status": "brn"
  },
  "secondaries": [
    {
      "chance": 10,
      "status": "brn"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Spread moves and ally damage](../articles/spread-and-ally-damage.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Burn](../articles/burn.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
