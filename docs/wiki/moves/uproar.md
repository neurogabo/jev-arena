# Uproar

`move:uproar` · Lasts 3 turns. Active Pokemon cannot fall asleep.

## Definition

The user spends three turns locked into this move. This move targets an opponent at random on each turn. On the first of the three turns, all sleeping active Pokemon wake up. During the three turns, no active Pokemon can fall asleep by any means, and Pokemon switched in during the effect do not wake up. If the user is prevented from moving or the attack is not successful against the target during one of the turns, the effect ends.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Special |
| Listed base power | 90 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | randomNormal — One randomly selected adjacent opposing Pokémon. |
| PP in Champions | 12 |
| Flags | bypasssub, failinstruct, metronome, mirror, nosleeptalk, protect, sound |

## Additional effect fields

```json
{
  "self": {
    "volatileStatus": "uproar"
  }
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
