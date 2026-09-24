# Champions-specific move details

Selected Champions move overrides, PP handling, tags, chances, and limitations of generic descriptions.

## Reference text

Include only rows belonging to the considered moves. These are differences worth preserving when assembling entity definitions; they are not a replacement for full move data.

| Move or feature | Pinned Champions behavior |
| --- | --- |
| Protect | Base PP 5; actual maximum/current PP remains an instance field. |
| Fake Out / First Impression | Disabled after the qualifying first action opportunity since entry. First Impression's base power is 100. |
| Freeze-Dry | No freezing secondary effect. Its special Water effectiveness remains a separate move rule. |
| Iron Head | Flinch secondary chance is 20%. |
| Moonblast | Special Attack-lowering secondary chance is 10%. |
| Dire Claw | 30% chance to attempt one randomly selected status among poison, paralysis, and sleep; it does not repeatedly reroll until a status succeeds. It also has the slicing tag. |
| Make It Rain | Accuracy 95%; its self effect lowers Special Attack by two stages when triggered. |
| Salt Cure | Residual damage is 1/16, or 1/8 against Water/Steel typing. |
| Rage Fist | The hit counter used by its power rule resets on switching in the Champions implementation. |
| Dragon Claw / Shadow Claw / Crush Claw | Have the slicing tag in the Champions overrides. |
| Milk Drink | Can target the adjacent ally or the user. |
| Toxic Thread | Its Speed drop is two stages. |
| Encore | Has Champions-specific queued-action replacement/priority handling. |
| Base PP above 20 | Champions caps the base value at 20 before applying its own PP calculation. |

Read all other power, accuracy, PP, target, and tag values from the resolved move definition. A legacy description is particularly unsafe if it conflicts with a Champions override. A move being defined in the repository does not prove that a legal M-C Pokémon can use it.

## Related articles

- [Move properties](move-properties.md)
- [Protect, Detect, and related personal protection](personal-protection.md)
- [Taunt, Encore, Disable, Torment, and Imprison](move-restrictions.md)
- [Choice lock, charging, recharge, and first-turn moves](locks-charge-recharge.md)
- [Special damage and multi-hit attacks](special-damage-multihit.md)

[Wiki home](../README.md) · [Directory](../directory.md)
