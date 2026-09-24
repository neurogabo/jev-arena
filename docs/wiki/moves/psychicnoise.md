# Psychic Noise

`move:psychicnoise` · For 2 turns, the target is prevented from healing.

## Definition

For 2 turns, the target is prevented from restoring any HP as long as it remains active. During the effect, healing and draining moves are unusable, and Abilities and items that grant healing will not heal the user. If an affected Pokemon uses Baton Pass, the replacement will remain unable to restore its HP. Pain Split and the Regenerator Ability are unaffected.

| Property | Resolved value |
| --- | --- |
| Type | Psychic |
| Category | Special |
| Listed base power | 75 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 12 |
| Flags | bypasssub, metronome, mirror, protect, sound |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 100,
    "volatileStatus": "healblock"
  },
  "secondaries": [
    {
      "chance": 100,
      "volatileStatus": "healblock"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md), [Substitute](../articles/substitute.md), [Safeguard, healing, and healing prevention](../articles/healing-and-safeguard.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
