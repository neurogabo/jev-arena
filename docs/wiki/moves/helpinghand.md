# Helping Hand

`move:helpinghand` · One adjacent ally's move power is 1.5× this turn.

## Definition

The power of the target's attack this turn is multiplied by 1.5 (this effect is stackable). Fails if there is no ally adjacent to the user or if the ally already moved this turn, but does not fail if the ally is using a two-turn move.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 5 |
| Target | adjacentAlly — The adjacent ally, not the user. |
| PP in Champions | 20 |
| Flags | bypasssub, failcopycat, noassist |

## Additional effect fields

```json
{
  "volatileStatus": "helpinghand"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
