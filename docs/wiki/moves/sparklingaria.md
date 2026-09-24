# Sparkling Aria

`move:sparklingaria` · The target is cured of its burn.

## Definition

If the user has not fainted, the target is cured of its burn.

| Property | Resolved value |
| --- | --- |
| Type | Water |
| Category | Special |
| Listed base power | 90 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | allAdjacent — All adjacent Pokémon other than the user, including its ally; spread targeting. |
| PP in Champions | 12 |
| Flags | bypasssub, metronome, mirror, protect, sound |

## Additional effect fields

```json
{
  "secondary": {
    "chance": 100,
    "volatileStatus": "sparklingaria"
  },
  "secondaries": [
    {
      "chance": 100,
      "volatileStatus": "sparklingaria"
    }
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Spread moves and ally damage](../articles/spread-and-ally-damage.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
