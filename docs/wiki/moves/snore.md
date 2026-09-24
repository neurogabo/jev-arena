# Snore

`move:snore` · User must be asleep. 30% chance to flinch target.

## Definition

Has a 30% chance to make the target flinch. Fails if the user is not asleep.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Special |
| Listed base power | 50 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 16 |
| Flags | bypasssub, mirror, protect, sound |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 30,
    "volatileStatus": "flinch"
  },
  "secondaries": [
    {
      "chance": 30,
      "volatileStatus": "flinch"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
