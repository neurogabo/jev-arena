# Flare Blitz

`move:flareblitz` · Has 33% recoil. 10% chance to burn. Thaws user.

## Definition

Has a 10% chance to burn the target. If the target lost HP, the user takes recoil damage equal to 33% the HP lost by the target, rounded half up, but not less than 1 HP.

| Property | Resolved value |
| --- | --- |
| Type | Fire |
| Category | Physical |
| Listed base power | 120 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 16 |
| Flags | contact, defrost, metronome, mirror, protect |

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
  ],
  "recoil": [
    33,
    100
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Burn](../articles/burn.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
