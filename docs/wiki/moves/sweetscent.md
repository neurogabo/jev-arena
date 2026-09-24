# Sweet Scent

`move:sweetscent` · Lowers the foe(s) evasiveness by 2.

## Definition

Lowers the target's evasiveness by 2 stages.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | allAdjacentFoes — All adjacent opposing Pokémon; spread targeting. |
| PP in Champions | 20 |
| Flags | metronome, mirror, protect, reflectable |

## Additional effect fields

```json
{
  "boosts": {
    "evasion": -2
  }
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Spread moves and ally damage](../articles/spread-and-ally-damage.md), [Move properties](../articles/move-properties.md), [Statistics and stat stages](../articles/statistics-and-stages.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
