# Terrain and status prevention

`interaction:terrain-status-prevention` · Groundedness and the timing of status application determine prevention.

## When to retrieve

Electric or Misty Terrain is present or might be set before a status attempt.

## Conditional rule

Electric Terrain prevents applicable sleep attempts against affected grounded Pokémon. Misty Terrain prevents applicable major-status and confusion attempts against affected grounded Pokémon. These are prevention rules, not automatic cures of an already established status.

## Exceptions and required state

Check current grounding, effective terrain, the actual status-application event, and move-specific exceptions. Yawn’s delayed sleep is evaluated when sleep would be applied, so the terrain at that later point matters.

## Linked definitions

[Electric Terrain](../moves/electricterrain.md), [Misty Terrain](../moves/mistyterrain.md), [Yawn](../moves/yawn.md), [Electric Terrain](../articles/electric-terrain.md), [Misty Terrain](../articles/misty-terrain.md), [Grounding and semi-invulnerability](../articles/grounding-and-hidden-states.md).

[Wiki home](../README.md) · [Directory](../directory.md)
