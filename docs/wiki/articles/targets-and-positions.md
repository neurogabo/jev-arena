# Targets and field positions

Target categories, positions, ally targeting, replacements, retargeting, and redirection.

## Reference text

The active field contains up to two Pokémon per side. In ordinary doubles, each active Pokémon is adjacent to the other three active positions. Use the supplied action's explicit target rather than inferring a target from the move's name.

| Target meaning | Interpretation |
| --- | --- |
| Self | The user. |
| Adjacent other Pokémon | A selected adjacent Pokémon other than the user; this may include an ally when permitted. |
| Adjacent foe | One selected adjacent opposing Pokémon. |
| Adjacent ally | The user's active partner. |
| Ally or self | A selected partner or the user. |
| All adjacent foes | All eligible opposing active positions. |
| All adjacent Pokémon | All eligible adjacent positions, including the user's partner, but not the user. |
| Ally side | An effect attached to the user's side. |
| Foe side | An effect attached to the opposing side. |
| Entire field | A field-wide effect, which follows its own rules. |
| Random target | The engine selects a target under the move's rules. |

Targets are generally resolved through positions. If the selected opponent switches, the replacement occupying that position ordinarily becomes the target. Ally Switch changes which Pokémon occupies each allied position without withdrawing either Pokémon.

If a selected opposing target has fainted before the action, an ordinary eligible single-target move can be redirected automatically to a remaining foe. A move specifically aimed at a fainted ally can fail instead. Automatic target selection does not turn an attack with no remaining foes into an attack against the user's partner. Special target-selection moves need their own definitions.

Redirection is an additional mechanic. Follow Me, Rage Powder, Lightning Rod, and Storm Drain can change a suitable single target. A move that hits multiple positions does not become a single-target move merely because only one Pokémon is presently affected. See the redirection and protection entries in the mechanics library.

## Related articles

- [Spread moves and ally damage](spread-and-ally-damage.md)
- [Switching, pivots, and replacements](switches-and-replacements.md)
- [Redirection](redirection.md)
- [Helping Hand and ally interaction](ally-interactions.md)

[Wiki home](../README.md) · [Directory](../directory.md)
