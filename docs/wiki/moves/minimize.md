# Minimize

`move:minimize` · Raises the user's evasiveness by 2.

## Definition

Raises the user's evasiveness by 2 stages. Whether or not the user's evasiveness was changed, Body Slam, Dragon Rush, Flying Press, Heat Crash, Heavy Slam, Malicious Moonsault, Steamroller, Stomp, and Supercell Slam will not check accuracy and have their damage doubled if used against the user while it is active.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 12 |
| Flags | metronome, snatch |

## Additional effect fields

```json
{
  "boosts": {
    "evasion": 2
  },
  "volatileStatus": "minimize"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Statistics and stat stages](../articles/statistics-and-stages.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
