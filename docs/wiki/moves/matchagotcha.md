# Matcha Gotcha

`move:matchagotcha` · 20% burn. Recovers 50% dmg dealt. Thaws foe(s).

## Definition

Has a 20% chance to burn the target. The user recovers 1/2 the HP lost by the target, rounded half up. If Big Root is held by the user, the HP recovered is 1.3× normal, rounded half down. The target thaws out if it is frozen.

| Property | Resolved value |
| --- | --- |
| Type | Grass |
| Category | Special |
| Listed base power | 80 |
| Accuracy | 90% before applicable modifiers |
| Base priority | 0 |
| Target | allAdjacentFoes — All adjacent opposing Pokémon; spread targeting. |
| PP in Champions | 16 |
| Flags | defrost, heal, metronome, mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 20,
    "status": "brn"
  },
  "secondaries": [
    {
      "chance": 20,
      "status": "brn"
    }
  ],
  "drain": [
    1,
    2
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Spread moves and ally damage](../articles/spread-and-ally-damage.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Burn](../articles/burn.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md), [Safeguard, healing, and healing prevention](../articles/healing-and-safeguard.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
