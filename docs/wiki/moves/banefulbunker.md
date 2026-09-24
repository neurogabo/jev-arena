# Baneful Bunker

`move:banefulbunker` · Protects from moves. Contact: poison.

## Definition

The user is protected from most attacks made by other Pokemon during this turn, and Pokemon making contact with the user become poisoned. This move has a 1/X chance of being successful, where X starts at 1 and triples each time this move is successfully used. X resets to 1 if this move fails, if the user's last move used is not Baneful Bunker, Burning Bulwark, Detect, Endure, King's Shield, Max Guard, Obstruct, Protect, Quick Guard, Silk Trap, Spiky Shield, or Wide Guard, or if it was one of those moves and the user's protection was broken. Fails if the user moves last this turn.

| Property | Resolved value |
| --- | --- |
| Type | Poison |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 4 |
| Target | self — The user. |
| PP in Champions | 8 |
| Flags | failcopycat, noassist |

## Additional effect fields

```json
{
  "volatileStatus": "banefulbunker"
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
