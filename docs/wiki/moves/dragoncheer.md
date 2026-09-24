# Dragon Cheer

`move:dragoncheer` · Ally: Crit ratio +1, or +2 if ally is Dragon type.

## Definition

Raises the target's chance for a critical hit by 1 stage, or by 2 stages if the target is Dragon type. Fails if there is no ally adjacent to the user, or if the target already has this effect or the Focus Energy effect. Baton Pass can be used to transfer this effect to an ally.

| Property | Resolved value |
| --- | --- |
| Type | Dragon |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | adjacentAlly — The adjacent ally, not the user. |
| PP in Champions | 16 |
| Flags | allyanim, bypasssub, metronome, sound |

## Additional effect fields

```json
{
  "volatileStatus": "dragoncheer"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
