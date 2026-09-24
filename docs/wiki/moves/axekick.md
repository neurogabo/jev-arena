# Axe Kick

`move:axekick` · 30% confusion. User loses 50% max HP if miss.

## Definition

Has a 30% chance to confuse the target. If this attack is not successful, the user loses half of its maximum HP, rounded down, as crash damage. Pokemon with the Magic Guard Ability are unaffected by crash damage.

| Property | Resolved value |
| --- | --- |
| Type | Fighting |
| Category | Physical |
| Listed base power | 120 |
| Accuracy | 90% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 12 |
| Flags | contact, metronome, mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 30,
    "volatileStatus": "confusion"
  },
  "secondaries": [
    {
      "chance": 30,
      "volatileStatus": "confusion"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
