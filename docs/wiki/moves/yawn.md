# Yawn

`move:yawn` · Puts the target to sleep after 1 turn.

## Definition

Causes the target to fall asleep at the end of the next turn. Fails when used if the target cannot fall asleep or if it already has a non-volatile status condition. At the end of the next turn, if the target is still active, does not have a non-volatile status condition, and can fall asleep, it falls asleep. If the target becomes affected, this effect cannot be prevented by Safeguard or a substitute, or by falling asleep and waking up during the effect.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 12 |
| Flags | metronome, mirror, protect, reflectable |

## Additional effect fields

```json
{
  "volatileStatus": "yawn"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Yawn, attraction, and Perish Song](../articles/yawn-attraction-perish.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
