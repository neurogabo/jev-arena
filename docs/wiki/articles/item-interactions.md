# Held-item interactions

Common held-item effects, consumption, thresholds, suppression, compatible Mega Stones, and triggered switches.

## Reference text

Include only the actual or explicitly hypothesized item entries. Dependencies: item presence and suppression, contact, damage timing, threshold checks, corresponding field effects.

| Item | Relevant behavior |
| --- | --- |
| Focus Sash | Consumed to preserve 1 HP against an eligible otherwise lethal hit when the holder begins that hit at full HP. Earlier chip damage or a later hit can defeat the protection. |
| Focus Band | Has a 10% chance to preserve 1 HP against an eligible otherwise lethal attack; it is different from Focus Sash's full-HP condition and consumption. |
| Sitrus Berry | Normally consumed when HP is at or below half maximum HP, restoring one quarter maximum HP if consumption and healing are permitted. |
| Lum Berry | Can be consumed to cure major status or confusion. It is not an ongoing immunity after consumption. |
| Mental Herb | A one-use cure for specified mental/move restrictions including attraction, Taunt, Encore, Disable, Torment, and the relevant healing-block condition. |
| White Herb | A one-use reset of negative stat stages to zero when its condition is reached; positive stages remain. |
| Rocky Helmet | Punishes applicable contact with damage equal to one sixth of the attacker's maximum HP. |
| Leftovers | Restores one sixteenth maximum HP at its residual recovery event. It cannot rescue a Pokémon already knocked out by an earlier event. |
| Choice Scarf | Multiplies effective Speed by 1.5 and applies its move lock; see M23. |
| Life Orb | Increases eligible attack damage by approximately 1.3 and normally causes one tenth maximum-HP recoil at its after-attack event. Sheer Force and Magic Guard interactions can change the recoil. |
| Air Balloon | Makes the holder ungrounded under ordinary conditions and pops on an applicable damaging hit. Ordinary residual chip does not automatically pop it. |
| Iron Ball | Halves Speed and grounds the holder. Its interaction with the Flying type's Ground immunity has dedicated handling; do not infer every dual-type damage result solely from the word “grounded.” |
| Light Clay | Extends a newly established relevant screen from five to eight turns. |
| Damp Rock / Heat Rock / Smooth Rock / Icy Rock | Extend newly established rain/sun/sandstorm/snow from five to eight turns. |
| Terrain Extender | Extends newly established terrain from five to eight turns. |
| Eject Button — Champions | After an eligible damaging move, can be consumed to switch the surviving holder to a chosen available reserve. It checks competing switch flags and other blocking conditions in the Champions override. |
| Red Card | After an eligible hit, can be consumed to force the surviving attacker toward a random eligible reserve under its own restrictions. It does not let the holder freely choose the opponent's replacement. |
| King's Rock | Adds its qualifying flinch chance to eligible attacks that do not already carry a flinch chance. Action order and flinch prevention remain relevant. |
| Compatible Mega Stone | Enables its specified Mega form when eligible. It has special removal and transfer restrictions when held by a compatible species. |

Damage-triggered switches, pivot moves, survival effects, berries, and secondary effects can compete at different moments. Read an Eject Button or Red Card interaction together with the move and the relevant ability, particularly Sheer Force or an automatic switch ability. The library does not assert a universal “every trigger activates” rule.

Trick and Switcheroo exchange items subject to their failure conditions. A compatible Mega Stone has transfer protection in the Champions definitions. Removing an item, consuming it, suppressing it, and changing its holder have different consequences.

## Related articles

- [Damage, contact, and secondary effects](damage-contact-secondary.md)
- [Mega Evolution and current form](mega-evolution.md)
- [Abilities and held items](ability-and-item-state.md)
- [Choice lock, charging, recharge, and first-turn moves](locks-charge-recharge.md)

[Wiki home](../README.md) · [Directory](../directory.md)
