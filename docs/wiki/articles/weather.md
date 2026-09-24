# Weather

Rain, sun, sandstorm, and snow: duration, damage and defensive modifiers, move effects, and suppression.

## Reference text

Include when weather is active or a considered move, switch-in ability, or Mega ability can set it. Dependencies: duration, suppression, relevant move/ability definitions, residual order.

Only one ordinary weather is active at a time. Establishing a different weather replaces the previous one. Ordinary rain, sun, sandstorm, and snow normally last five turns, or eight when established by a Pokémon with the corresponding effective weather-extending rock. The creation turn counts toward the duration. An ability-created ordinary weather is not automatically permanent.

| Weather | General effects |
| --- | --- |
| Rain | Water damage is ordinarily multiplied by 1.5 and Fire damage by 0.5. |
| Sun | Fire damage is ordinarily multiplied by 1.5 and Water damage by 0.5; new freeze is normally prevented. |
| Sandstorm | Rock types receive 1.5× Special Defense. Susceptible active Pokémon take 1/16 maximum-HP sand damage at the relevant weather event. Rock, Ground, and Steel types are naturally immune to that chip damage. |
| Snow | Ice types receive 1.5× Defense. Snow itself does not inflict hail-style chip damage. |

These boosts are not generic same-type attack boosts: sandstorm does not by itself boost all Rock attacks, and snow does not by itself boost all Ice attacks.

Move-specific weather behavior matters. Thunder and Hurricane bypass their ordinary accuracy checks in rain and ordinarily have 50% accuracy in sun. Blizzard bypasses its ordinary accuracy check in snow. Solar Beam and Solar Blade ordinarily skip their charging turn in sun and have reduced power in certain other weather. Weather Ball changes type and power with applicable weather. The relevant move definitions must accompany those interactions.

Swift Swim, Chlorophyll, Sand Rush, and Slush Rush provide their own weather-dependent Speed effects when the matching ability is present and active. A species does not receive such an effect merely because it is associated with rain, sun, sand, or snow.

Cloud Nine and Air Lock suppress the effects of weather while active. Suppression does not necessarily delete the stored weather or stop its duration from elapsing. When suppression ends, the remaining weather can matter again. The order of competing weather setters determines the resulting weather.

## Related articles

- [Action order](action-order.md)
- [Other type-based immunities](type-immunities.md)
- [Freeze — Champions](freeze.md)
- [Gravity, Trick Room, Tailwind, and other rooms](rooms-gravity-tailwind.md)
- [Ability interactions](ability-interactions.md)
- [Held-item interactions](item-interactions.md)

[Wiki home](../README.md) · [Directory](../directory.md)
