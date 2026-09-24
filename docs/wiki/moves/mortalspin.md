# Mortal Spin

`move:mortalspin` · Poisons foes, frees user from hazards/bind/leech.

## Definition

If this move is successful and the user has not fainted, the effects of Leech Seed and binding moves end for the user, and all hazards are removed from the user's side of the field. Has a 100% chance to poison the target.

| Property | Resolved value |
| --- | --- |
| Type | Poison |
| Category | Physical |
| Listed base power | 30 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | allAdjacentFoes — All adjacent opposing Pokémon; spread targeting. |
| PP in Champions | 16 |
| Flags | contact, metronome, mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 100,
    "status": "psn"
  },
  "secondaries": [
    {
      "chance": 100,
      "status": "psn"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Spread moves and ally damage](../articles/spread-and-ally-damage.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Poison and bad poison](../articles/poison-and-toxic.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
