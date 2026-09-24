# Discharge

`move:discharge` · 30% chance to paralyze adjacent Pokemon.

## Definition

Has a 30% chance to paralyze the target.

| Property | Resolved value |
| --- | --- |
| Type | Electric |
| Category | Special |
| Listed base power | 80 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | allAdjacent — All adjacent Pokémon other than the user, including its ally; spread targeting. |
| PP in Champions | 16 |
| Flags | metronome, mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 30,
    "status": "par"
  },
  "secondaries": [
    {
      "chance": 30,
      "status": "par"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Spread moves and ally damage](../articles/spread-and-ally-damage.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Paralysis — Champions](../articles/paralysis.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
