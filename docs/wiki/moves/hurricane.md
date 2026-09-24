# Hurricane

`move:hurricane` · 30% chance to confuse target. Can't miss in rain.

## Definition

Has a 30% chance to confuse the target. This move can hit a target using Bounce, Fly, or Sky Drop, or is under the effect of Sky Drop. If the weather is Heavy Rain or Rain, this move does not check accuracy. If the weather is Intense Sun or Sun, this move's accuracy is 50%. If this move is used against a Pokemon holding Utility Umbrella, this move's accuracy remains at 70%.

| Property | Resolved value |
| --- | --- |
| Type | Flying |
| Category | Special |
| Listed base power | 110 |
| Accuracy | 70% before applicable modifiers |
| Base priority | 0 |
| Target | any — One other Pokémon, with move-specific restrictions. |
| PP in Champions | 12 |
| Flags | distance, metronome, mirror, protect, wind |

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
