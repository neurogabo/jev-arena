# Teeter Dance

`move:teeterdance` · Confuses adjacent Pokemon.

## Definition

Causes the target to become confused.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | allAdjacent — All adjacent Pokémon other than the user, including its ally; spread targeting. |
| PP in Champions | 20 |
| Flags | dance, metronome, mirror, protect |

## Additional effect fields

```json
{
  "volatileStatus": "confusion"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Spread moves and ally damage](../articles/spread-and-ally-damage.md), [Move properties](../articles/move-properties.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
