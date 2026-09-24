# Attract

`move:attract` · A target of the opposite gender gets infatuated.

## Definition

Causes the target to become infatuated, making it unable to attack 50% of the time. Fails if both the user and the target are the same gender, if either is genderless, or if the target is already infatuated. The effect ends when either the user or the target is no longer active. Pokemon with the Oblivious Ability or protected by the Aroma Veil Ability are immune.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 16 |
| Flags | bypasssub, metronome, mirror, protect, reflectable |

## Additional effect fields

```json
{
  "volatileStatus": "attract"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
