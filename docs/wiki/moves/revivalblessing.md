# Revival Blessing

`move:revivalblessing` · Revives a fainted Pokemon to 50% HP.

## Definition

A fainted party member is selected and revived with 1/2 its max HP, rounded down. Fails if there are no fainted party members.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 1 |
| Flags | heal, nosketch |

## Additional effect fields

```json
{
  "slotCondition": "revivalblessing",
  "selfSwitch": true
}
```

Uncertain interaction: the resulting form when Revival Blessing revives a Mega-Evolved Pokémon.

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Switching, pivots, and replacements](../articles/switches-and-replacements.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
