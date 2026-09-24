# Wide Guard

`move:wideguard` · Protects allies from multi-target moves this turn.

## Definition

The user and its party members are protected from moves made by other Pokemon, including allies, during this turn that target all adjacent foes or all adjacent Pokemon. This move modifies the same 1/X chance of being successful used by other protection moves, where X starts at 1 and triples each time this move is successfully used, but does not use the chance to check for failure. X resets to 1 if this move fails, if the user's last move used is not Baneful Bunker, Burning Bulwark, Detect, Endure, King's Shield, Max Guard, Obstruct, Protect, Quick Guard, Silk Trap, Spiky Shield, or Wide Guard, or if it was one of those moves and the user's protection was broken. Fails if the user moves last this turn or if this move is already in effect for the user's side.

| Property | Resolved value |
| --- | --- |
| Type | Rock |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 3 |
| Target | allySide — The user’s side of the field. |
| PP in Champions | 12 |
| Flags | snatch |

## Additional effect fields

```json
{
  "sideCondition": "wideguard"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Wide Guard and Quick Guard](../articles/wide-and-quick-guard.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
