# Move execution and failure

Execution checks, interrupted actions, PP expenditure, and events that change a move before it resolves.

## Reference text

When a Pokémon reaches its action, it must still be able to act. Sleep, freeze, flinching, confusion, paralysis, recharge, and move restrictions can prevent or alter execution. Their checks have different timings; do not assume all possible failure rolls occur independently on every turn.

Being unable to act before the move starts is different from using a move that misses or is blocked. The ordinary engine checks whether the Pokémon can move before deducting PP. A move that proceeds to execution normally spends PP even if it subsequently misses or fails, subject to its specific rules.

For an ordinary attack, relevant checks include whether the target can be reached, protection or interception effects, type immunity, move-specific immunity, accuracy, and the hit's damage and effects. Individual moves may add their own conditions. A move's listed secondary effect does not bypass those conditions merely because its listed chance is 100%.

Events caused by one action can resolve before the next Pokémon acts. These include item consumption, reactive abilities, stat changes, knockouts, and switches. A selected target or partner may therefore have changed by the time an action is executed.

## Related articles

- [Accuracy and evasion](accuracy-and-evasion.md)
- [Paralysis — Champions](paralysis.md)
- [Sleep — Champions](sleep.md)
- [Freeze — Champions](freeze.md)
- [Confusion and flinching](confusion-and-flinching.md)
- [Taunt, Encore, Disable, Torment, and Imprison](move-restrictions.md)
- [Choice lock, charging, recharge, and first-turn moves](locks-charge-recharge.md)

[Wiki home](../README.md) · [Directory](../directory.md)
