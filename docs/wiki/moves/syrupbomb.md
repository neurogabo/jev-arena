# Syrup Bomb

`move:syrupbomb` · Target's Speed is lowered by 1 stage for 3 turns.

## Definition

If this move is successful, it causes the target's Speed to be lowered by 1 stage at the end of each turn for 3 turns.

| Property | Resolved value |
| --- | --- |
| Type | Grass |
| Category | Special |
| Listed base power | 60 |
| Accuracy | 90% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 12 |
| Flags | bullet, metronome, mirror, protect |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 100,
    "volatileStatus": "syrupbomb"
  },
  "secondaries": [
    {
      "chance": 100,
      "volatileStatus": "syrupbomb"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
