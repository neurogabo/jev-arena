# Ordinary damage

The inputs to ordinary damage, ordered modifiers, STAB, random variation, and special-stat exceptions.

## Reference text

For a standard damaging move, damage depends on level, effective base power, the relevant offensive and defensive statistics, and the applicable modifiers. Higher base power alone does not establish which attack will deal more damage or produce the best position.

The ordinary underlying relationship is proportional to `((2 × level / 5 + 2) × power × offense / defense) / 50 + 2`, followed by applicable modifiers. Showdown uses intermediate integer operations, ordered modifiers, and fixed-point rounding. This relationship explains the inputs; it is not an instruction to treat an approximate calculation as an exact damage roll.

Common modifiers include:

- **Same-type attack bonus:** normally 1.5× if the move shares one of the user's current applicable types. Sharing both types does not create two separate STAB multipliers. Abilities can alter STAB.
- **Type effectiveness:** the product of the applicable defensive matchups.
- **Spread damage:** normally 0.75× when the move qualifies as a spread hit.
- **Weather:** such as rain increasing Water damage and reducing Fire damage.
- **Critical hits:** normally 1.5×, with additional stage-handling rules.
- **Damage variation:** the ordinary random factor uses integers from 85 through 100 percent, inclusive.
- **Burn:** normally halves physical damage, with relevant exceptions.
- **Other effects:** screens, abilities, items, terrain, Helping Hand, and move-specific conditions.

Do not automatically apply this entire modifier chain to fixed-damage moves, HP-setting effects, one-hit knockout moves, indirect damage, or recoil. Their definitions specify different rules.

Physical and special describe the move's category, not necessarily the exact statistics it uses. Moves can explicitly use the target's Attack, the user's Defense, the target's physical Defense despite being special, or other substitutions. Use the supplied definition for those exceptions.

## Related articles

- [Spread moves and ally damage](spread-and-ally-damage.md)
- [Complete ordinary type matchups](type-matchups.md)
- [Statistics and stat stages](statistics-and-stages.md)
- [Critical hits](critical-hits.md)
- [Reflect, Light Screen, and Aurora Veil](screens.md)

[Wiki home](../README.md) · [Directory](../directory.md)
