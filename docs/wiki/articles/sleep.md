# Sleep — Champions

Champions sleep counters, waking checks, Early Bird, Rest, bench time, and sleep prevention.

## Reference text

Include when sleep, Rest, Yawn, or a sleep-causing move is relevant. Dependencies: before-move checks, major status, sleep-prevention effects.

Ordinary sleep initializes a hidden counter to 2 with probability 1/3 and to 3 with probability 2/3. Each reached sleep check reduces the counter before deciding whether the Pokémon wakes. Without an intervening cure or modifier, the first sleep check prevents an ordinary move; the second check wakes the Pokémon in the 1/3 branch; otherwise the third check wakes it. The Pokémon can execute its chosen move on the check that wakes it.

These are sleep checks, not simply elapsed calendar turns. A Pokémon put to sleep before its action can reach its first sleep check in that same turn. Time spent on the bench does not itself consume these checks, and ordinary switching does not reset the remaining sleep counter in this environment.

Early Bird adds an extra counter decrement at each sleep check. Moves explicitly usable while asleep can still execute according to their definitions. Sleep Talk has its own selection and failure rules; knowing Sleep Talk does not make other selected moves sleep-usable.

Rest explicitly sets its own sleep counter to 3 after healing succeeds. Ordinarily, this prevents the next two ordinary move attempts and permits waking on the third. Do not use the ordinary random sleep distribution for Rest.

Sleep prevention can come from an ability or from grounded terrain effects. Electric Terrain does not wake a Pokémon that was already asleep. Sleep being prevented or cured may have different timing depending on the source.

## Related articles

- [Move execution and failure](move-execution.md)
- [Statuses, volatile effects, and counters](statuses-and-counters.md)
- [Yawn, attraction, and Perish Song](yawn-attraction-perish.md)
- [Electric Terrain](electric-terrain.md)
- [Misty Terrain](misty-terrain.md)

[Wiki home](../README.md) · [Directory](../directory.md)
