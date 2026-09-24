# Contact and Rocky Helmet

`interaction:contact-and-helmet` · Damage category does not determine whether a move makes contact.

## When to retrieve

An effective Rocky Helmet holder may be hit by a contact move.

## Conditional rule

Rocky Helmet responds to qualifying contact hits by damaging the attacker for one sixth of its maximum HP. A multi-hit contact move can trigger the effect for multiple hits. Contact is a move flag, not a synonym for Physical category.

## Exceptions and required state

Check actual contact at the hit event: Long Reach and other effects can prevent contact behavior. Item suppression, substitute routing, and effects that prevent indirect damage can change the result. Do not charge recoil merely because the attacker selected a contact move that failed to connect.

## Linked definitions

[Rocky Helmet](../items/rockyhelmet.md), [Long Reach](../abilities/longreach.md), [Move properties](../articles/move-properties.md), [Damage, contact, and secondary effects](../articles/damage-contact-secondary.md), [Special damage and multi-hit attacks](../articles/special-damage-multihit.md).

[Wiki home](../README.md) · [Directory](../directory.md)
