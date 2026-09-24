# Perish Song

`move:perishsong` · All active Pokemon will faint in 3 turns.

## Definition

Each active Pokemon receives a perish count of 4 if it doesn't already have a perish count. At the end of each turn including the turn used, the perish count of all active Pokemon lowers by 1 and Pokemon faint if the number reaches 0. The perish count is removed from Pokemon that switch out. If a Pokemon uses Baton Pass while it has a perish count, the replacement will gain the perish count and continue to count down.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | all — The field/all active Pokémon as defined by the effect. |
| PP in Champions | 8 |
| Flags | bypasssub, distance, metronome, sound |

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Yawn, attraction, and Perish Song](../articles/yawn-attraction-perish.md), [Substitute](../articles/substitute.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
