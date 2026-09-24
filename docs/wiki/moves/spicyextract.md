# Spicy Extract

`move:spicyextract` · Raises target's Atk by 2 and lowers its Def by 2.

## Definition

Raises the target's Attack by 2 stages and lowers its Defense by 2 stages.

| Property | Resolved value |
| --- | --- |
| Type | Grass |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 16 |
| Flags | mirror, protect, reflectable |

## Additional effect fields

```json
{
  "boosts": {
    "atk": 2,
    "def": -2
  }
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Statistics and stat stages](../articles/statistics-and-stages.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
