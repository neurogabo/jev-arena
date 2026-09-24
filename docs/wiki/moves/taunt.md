# Taunt

`move:taunt` · Target can't use status moves its next 3 turns.

## Definition

Prevents the target from using non-damaging moves for its next three turns. Pokemon with the Oblivious Ability or protected by the Aroma Veil Ability are immune.

| Property | Resolved value |
| --- | --- |
| Type | Dark |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 20 |
| Flags | bypasssub, metronome, mirror, protect, reflectable |

## Additional effect fields

```json
{
  "volatileStatus": "taunt"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md), [Substitute](../articles/substitute.md), [Taunt, Encore, Disable, Torment, and Imprison](../articles/move-restrictions.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
