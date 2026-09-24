# Flatter

`move:flatter` · Raises the target's Sp. Atk by 1 and confuses it.

## Definition

Raises the target's Special Attack by 1 stage and confuses it.

| Property | Resolved value |
| --- | --- |
| Type | Dark |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 16 |
| Flags | allyanim, metronome, mirror, protect, reflectable |

## Additional effect fields

```json
{
  "boosts": {
    "spa": 1
  },
  "volatileStatus": "confusion"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Statistics and stat stages](../articles/statistics-and-stages.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
