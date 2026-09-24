# Body Slam

`move:bodyslam` · 30% chance to paralyze the target.

## Definition

Has a 30% chance to paralyze the target. Damage doubles and no accuracy check is done if the target has used Minimize while active.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Physical |
| Listed base power | 85 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 16 |
| Flags | contact, metronome, minimize, mirror, nonsky, protect |

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

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Paralysis — Champions](../articles/paralysis.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
