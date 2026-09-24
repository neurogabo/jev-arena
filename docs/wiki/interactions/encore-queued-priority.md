# Champions Encore and queued priority

`interaction:encore-queued-priority` · Encore can replace a pending move and change its priority.

## When to retrieve

Encore may land before the target executes a different selected move.

## Conditional rule

When the last move is eligible, Encore forces repetition under its duration and PP rules. Encore can replace a pending move and adjust its priority by the difference between the old and repeated move’s base priorities.

## Exceptions and required state

Check last move, eligibility flags, PP, whether an action remains queued, and Mental Herb. Mental Herb’s effect on the pending move’s priority is uncertain.

## Linked definitions

[Encore](../moves/encore.md), [Mental Herb](../items/mentalherb.md), [Taunt, Encore, Disable, Torment, and Imprison](../articles/move-restrictions.md), [Action order](../articles/action-order.md).

[Wiki home](../README.md) · [Directory](../directory.md)
