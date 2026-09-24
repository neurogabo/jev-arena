# Bounce

`move:bounce` · Bounces turn 1. Hits turn 2. 30% paralyze.

## Definition

Has a 30% chance to paralyze the target. This attack charges on the first turn and executes on the second. On the first turn, the user avoids all attacks other than Gust, Hurricane, Sky Uppercut, Smack Down, Thousand Arrows, Thunder, and Twister, and Gust and Twister have doubled power when used against it. If the user is holding a Power Herb, the move completes in one turn.

| Property | Resolved value |
| --- | --- |
| Type | Flying |
| Category | Physical |
| Listed base power | 85 |
| Accuracy | 85% before applicable modifiers |
| Base priority | 0 |
| Target | any — One other Pokémon, with move-specific restrictions. |
| PP in Champions | 8 |
| Flags | charge, contact, distance, failinstruct, gravity, metronome, mirror, noassist, nosleeptalk, protect |

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
