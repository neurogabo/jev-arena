# Rage Powder

`move:ragepowder` · The foes' moves target the user on the turn used.

## Definition

Until the end of the turn, all single-target attacks from the opposing side are redirected to the user. Such attacks are redirected to the user before they can be reflected by Magic Coat or the Magic Bounce Ability, or drawn in by the Lightning Rod or Storm Drain Abilities. Fails if it is not a Double Battle or Battle Royal. This effect is ignored while the user is under the effect of Sky Drop.

| Property | Resolved value |
| --- | --- |
| Type | Bug |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 2 |
| Target | self — The user. |
| PP in Champions | 20 |
| Flags | failcopycat, noassist, powder |

## Additional effect fields

```json
{
  "volatileStatus": "ragepowder"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Redirection](../articles/redirection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
