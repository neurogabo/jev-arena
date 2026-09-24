# Grassy Glide and terrain-dependent priority

`interaction:grassy-glide-priority` · A move can gain priority only under its actual terrain conditions.

## When to retrieve

Grassy Glide is considered while Grassy Terrain is present or might be replaced.

## Conditional rule

Grassy Glide gains one priority level when its user is affected by Grassy Terrain. Grounding and the currently effective terrain therefore matter to move order and priority-blocking effects.

## Exceptions and required state

Do not permanently encode it as a +1 move. Terrain can be changed before execution, and the engine’s ordering/priority events decide the relevant timing. Check current user grounding and all other priority modifiers.

## Linked definitions

[Grassy Glide](../moves/grassyglide.md), [Grassy Terrain](../moves/grassyterrain.md), [Grassy Surge](../abilities/grassysurge.md), [Action order](../articles/action-order.md), [Grounding and semi-invulnerability](../articles/grounding-and-hidden-states.md), [Grassy Terrain](../articles/grassy-terrain.md).

[Wiki home](../README.md) · [Directory](../directory.md)
