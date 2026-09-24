# End-of-turn effects and fainting

Sequential residual events, effect expiry, fainting, replacement timing, and battle completion.

## Reference text

Residual effects execute in an order, rather than as one simultaneous sum of damage and healing. Early chip damage can cause a knockout before a later recovery effect. Expiration of weather, terrain, or another effect can change whether a later effect applies.

The relevant order includes weather processing; delayed attacks and Wish; terrain and selected recovery effects; Leech Seed; poison and burn; binding and Salt Cure; restrictions and delayed effects; Perish Song; expiration of side and field conditions; and later ability or item events. The library provides a more precise selected-effect ordering with explicit limits.

Fainted Pokémon cannot perform their pending ordinary actions. Knockouts can remove an ability's field influence or invalidate a partner interaction. Replacement requests follow the engine's timing; a knockout during a move does not always mean that a replacement immediately occupies the target's position before the rest of that move.

The engine determines battle completion and simultaneous-knockout resolution. Do not infer an exact winner from a simplified net-HP calculation when recoil, contact damage, delayed damage, or other queued events can change the result.

## Related articles

- [Statuses, volatile effects, and counters](statuses-and-counters.md)
- [Switching, pivots, and replacements](switches-and-replacements.md)
- [Selected end-of-turn ordering](residual-order.md)

[Wiki home](../README.md) · [Directory](../directory.md)
