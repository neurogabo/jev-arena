# Selected end-of-turn ordering

Selected end-of-turn event order, recovery before or after damage, expiry, suborders, and fainting limits.

## Reference text

Include when multiple residual effects, recovery, expiry, or delayed events are relevant. Dependencies: current effect counters, active Pokémon, ability/item suppression, fainting.

This table lists selected end-of-turn effects. Earlier applicable events resolve first; an effect can expire before its next activation. Events in the same family can have additional ordering by suborder and holder.

| Relative order | Selected effects |
| ---: | --- |
| 1 | Weather duration/processing and weather-triggered events. |
| 3 | Future attack resolution. |
| 4 | Wish. |
| 5 | Selected passive effects: Grassy Terrain recovery at suborder 2, Healer at suborder 3, Leftovers at suborder 4. |
| 6–7 | Aqua Ring, then Ingrain recovery. |
| 8 | Leech Seed. |
| 9 | Poison or bad poison. |
| 10 | Burn. |
| 11–12 | Nightmare, then Curse. |
| 13–14 | Binding/Salt Cure, then effects such as Octolock. |
| 15–17 | Taunt, Encore, Disable duration processing. |
| 23 | Yawn. |
| 24 | Perish Song. |
| 26 | Side-condition duration processing, including screens and Tailwind, with their own suborders. |
| 27 | Field-condition duration processing, including Trick Room, Gravity, other rooms, and terrain. |
| 28 and later | Selected late ability/item updates such as Speed Boost or Harvest; other late effects are possible. |

The numbers indicate ordering, not turn counts or priority brackets for chosen moves. A Pokémon can faint before its next listed recovery opportunity. Grassy Terrain's recovery occurs before its later terrain-duration expiration step; weather uses different event placement. Do not apply one generic expiration rule to every effect.

For shared-order events or simultaneous knockouts, preserve the engine's actual event history. A request without enough information to resolve a fine timing interaction does not justify inventing an exact result.

## Related articles

- [End-of-turn effects and fainting](residual-effects-and-fainting.md)
- [Poison and bad poison](poison-and-toxic.md)
- [Leech Seed, binding, Salt Cure, and Curse](persistent-damage.md)
- [Weather](weather.md)
- [Grassy Terrain](grassy-terrain.md)
- [Safeguard, healing, and healing prevention](healing-and-safeguard.md)

[Wiki home](../README.md) · [Directory](../directory.md)
