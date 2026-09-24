# Baton Pass

`move:batonpass` · User switches, passing stat changes and more.

## Definition

The user is replaced with another Pokemon in its party. The selected Pokemon has the user's stat stage changes transferred to it, as well as the effects of confusion, Aqua Ring, Curse, Dragon Cheer, Embargo, Focus Energy, Gastro Acid, Heal Block, Ingrain, Leech Seed, Lock-On (Mind Reader), Magnet Rise, Perish Song, Power Trick, Telekinesis, and a substitute with its remaining HP. The effect of Gastro Acid is not transferred if the recipient has an Ability that cannot be affected.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 20 |
| Flags | metronome |

## Additional effect fields

```json
{
  "self": {},
  "selfSwitch": "copyvolatile"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Switching, pivots, and replacements](../articles/switches-and-replacements.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
