# Circle Throw

`move:circlethrow` · Forces the target to switch to a random ally.

## Definition

If both the user and the target have not fainted, the target is forced to switch out and be replaced with a random unfainted ally. This effect fails if the target is under the effect of Ingrain, has the Suction Cups Ability, or this move hit a substitute.

| Property | Resolved value |
| --- | --- |
| Type | Fighting |
| Category | Physical |
| Listed base power | 60 |
| Accuracy | 90% before applicable modifiers |
| Base priority | -6 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 12 |
| Flags | contact, failcopycat, metronome, mirror, noassist, protect |

## Additional effect fields

```json
{
  "forceSwitch": true
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Complete ordinary type matchups](../articles/type-matchups.md), [Other type-based immunities](../articles/type-immunities.md), [Ordinary damage](../articles/ordinary-damage.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Switching, pivots, and replacements](../articles/switches-and-replacements.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
