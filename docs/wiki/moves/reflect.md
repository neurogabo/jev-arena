# Reflect

`move:reflect` · For 5 turns, physical damage to allies is halved.

## Definition

For 5 turns, the user and its party members take 0.5× damage from physical attacks, or 0.66× damage if in a Double Battle. Damage is not reduced further with Aurora Veil. Critical hits ignore this effect. It is removed from the user's side if the user or an ally is successfully hit by Brick Break, Psychic Fangs, or Defog. Lasts for 8 turns if the user is holding Light Clay. Fails if the effect is already active on the user's side.

| Property | Resolved value |
| --- | --- |
| Type | Psychic |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | allySide — The user’s side of the field. |
| PP in Champions | 20 |
| Flags | metronome, snatch |

## Additional effect fields

```json
{
  "sideCondition": "reflect"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Reflect, Light Screen, and Aurora Veil](../articles/screens.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
