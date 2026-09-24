# Upper Hand and pending priority attacks

`interaction:upper-hand-eligibility` · Upper Hand depends on the target’s still-pending action.

## When to retrieve

Upper Hand may be used against a possible positive-priority attack.

## Conditional rule

Upper Hand has base priority +3. It fails unless the target still has a pending damaging move with positive effective priority. Its flinch effect matters only if the hit succeeds and the target can flinch before acting.

## Exceptions and required state

Protect, a switch, an ordinary nonpriority move, a status move, or a target that already acted does not satisfy that eligibility check. At equal priority, Speed and ties can decide whether the target has already acted. Type immunity and flinch immunity are separate checks.

## Linked definitions

[Upper Hand](../moves/upperhand.md), [Action order](../articles/action-order.md), [Confusion and flinching](../articles/confusion-and-flinching.md), [Other type-based immunities](../articles/type-immunities.md).

[Wiki home](../README.md) · [Directory](../directory.md)
