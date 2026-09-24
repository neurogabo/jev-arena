# Shed Tail

`move:shedtail` · User takes 1/2 its max HP to pass a substitute.

## Definition

The user takes 1/2 of its maximum HP, rounded up, and creates a substitute that has 1/4 of the user's maximum HP, rounded down. The user is replaced with another Pokemon in its party and the selected Pokemon has the substitute transferred to it. Fails if the user would faint, or if there are no unfainted party members.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 12 |

## Additional effect fields

```json
{
  "self": {},
  "volatileStatus": "substitute",
  "selfSwitch": "shedtail"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Switching, pivots, and replacements](../articles/switches-and-replacements.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
