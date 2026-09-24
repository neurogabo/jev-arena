# Sky Attack

`move:skyattack` · Charges, then hits turn 2. 30% flinch. High crit.

## Definition

Has a 30% chance to make the target flinch and a higher chance for a critical hit. This attack charges on the first turn and executes on the second. If the user is holding a Power Herb, the move completes in one turn.

| Property | Resolved value |
| --- | --- |
| Type | Flying |
| Category | Physical |
| Listed base power | 140 |
| Accuracy | 90% before applicable modifiers |
| Base priority | 0 |
| Target | any — One other Pokémon, with move-specific restrictions. |
| PP in Champions | 8 |
| Flags | charge, distance, failinstruct, metronome, mirror, nosleeptalk, protect |

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
  ],
  "critRatio": 2
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
