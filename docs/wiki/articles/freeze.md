# Freeze — Champions

Champions freeze checks, guaranteed expiry, thawing moves, typing, and effective sun.

## Reference text

Include when freeze exists or a considered effect can cause it. Dependencies: before-move checks, major status, thawing move flags and relevant immunities.

Ordinary freeze initializes a counter to 3. When its ordinary before-move check is reached, the counter decreases. If it has reached zero, the Pokémon thaws. Otherwise there is a **1/4 probability of thawing at that check**. A Pokémon that thaws can act on that action.

Without other effects, the first and second checks each offer a 25% thaw chance conditional on still being frozen; the third check guarantees thawing. This does not mean three guaranteed lost turns. Bench time does not itself perform a thaw check.

A move explicitly flagged to thaw its user can bypass the ordinary frozen-action block and clear freeze through its own execution. Certain hits can thaw the target. Ordinary damaging Fire moves can thaw a frozen target when the relevant damage event occurs; an immunity that prevents the hit can also prevent that cure. Use the move and ability definitions for exceptions.

Ice types cannot ordinarily be newly frozen. Effective sun prevents new freeze through its weather immunity rule; it is not a blanket instruction to clear every existing frozen status immediately. Freeze-Dry has **no freezing secondary effect in the pinned Champions data**.

## Related articles

- [Move execution and failure](move-execution.md)
- [Other type-based immunities](type-immunities.md)
- [Statuses, volatile effects, and counters](statuses-and-counters.md)
- [Weather](weather.md)

[Wiki home](../README.md) · [Directory](../directory.md)
