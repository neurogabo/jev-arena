# Petal Dance

`move:petaldance` · Lasts 2-3 turns. Confuses the user afterwards.

## Definition

The user spends two or three turns locked into this move and becomes confused immediately after its move on the last turn of the effect if it is not already. This move targets an opposing Pokemon at random on each turn. If the user is prevented from moving, is asleep at the beginning of a turn, or the attack is not successful against the target on the first turn of the effect or the second turn of a three-turn effect, the effect ends without causing confusion. If this move is called by Sleep Talk and the user is asleep, the move is used for one turn and does not confuse the user.

| Property | Resolved value |
| --- | --- |
| Type | Grass |
| Category | Special |
| Listed base power | 120 |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | randomNormal — One randomly selected adjacent opposing Pokémon. |
| PP in Champions | 12 |
| Flags | contact, dance, failinstruct, metronome, mirror, protect |

## Additional effect fields

```json
{
  "self": {
    "volatileStatus": "lockedmove"
  }
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
