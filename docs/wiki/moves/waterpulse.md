# Water Pulse

`move:waterpulse` · 20% chance to confuse the target.

## Definition

Has a 20% chance to confuse the target.

| Property | Resolved value |
| --- | --- |
| Type | Water |
| Category | Special |
| Listed base power | 60 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | any — One other Pokémon, with move-specific restrictions. |
| PP in Champions | 20 |
| Flags | distance, metronome, mirror, protect, pulse |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 20,
    "volatileStatus": "confusion"
  },
  "secondaries": [
    {
      "chance": 20,
      "volatileStatus": "confusion"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
