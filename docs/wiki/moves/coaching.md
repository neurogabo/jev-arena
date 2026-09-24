# Coaching

`move:coaching` · Raises an ally's Attack and Defense by 1.

## Definition

Raises the target's Attack and Defense by 1 stage. Fails if there is no ally adjacent to the user.

| Property | Resolved value |
| --- | --- |
| Type | Fighting |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | adjacentAlly — The adjacent ally, not the user. |
| PP in Champions | 12 |
| Flags | allyanim, bypasssub, metronome |

## Additional effect fields

```json
{
  "boosts": {
    "atk": 1,
    "def": 1
  }
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Statistics and stat stages](../articles/statistics-and-stages.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
