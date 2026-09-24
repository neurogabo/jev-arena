# Rock Slide

`move:rockslide` · 30% chance to make the foe(s) flinch.

## Definition

Has a 30% chance to make the target flinch.

| Property | Resolved value |
| --- | --- |
| Type | Rock |
| Category | Physical |
| Listed base power | 75 |
| Accuracy | 90% before applicable modifiers |
| Base priority | 0 |
| Target | allAdjacentFoes — All adjacent opposing Pokémon; spread targeting. |
| PP in Champions | 12 |
| Flags | metronome, mirror, protect |

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

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Spread moves and ally damage](../articles/spread-and-ally-damage.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
