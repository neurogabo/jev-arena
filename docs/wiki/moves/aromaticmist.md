# Aromatic Mist

`move:aromaticmist` · Raises an ally's Sp. Def by 1.

## Definition

Raises the target's Special Defense by 1 stage. Fails if there is no ally adjacent to the user.

| Property | Resolved value |
| --- | --- |
| Type | Fairy |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | adjacentAlly — The adjacent ally, not the user. |
| PP in Champions | 20 |
| Flags | bypasssub, metronome |

## Additional effect fields

```json
{
  "boosts": {
    "spd": 1
  }
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Statistics and stat stages](../articles/statistics-and-stages.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
