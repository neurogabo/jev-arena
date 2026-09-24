# Taunt, Encore, Disable, Torment, and Imprison

Taunt, Encore, Disable, Torment, and Imprison, including selected-action changes and Champions exceptions.

## Reference text

Include each relevant restriction. Dependencies: last move, PP, current actions, status-versus-damaging category, relevant immunity and cure definitions.

**Taunt:** Prevents ordinary status moves for the target's next three relevant turns. It can prevent a previously selected status move if Taunt takes effect before that move executes. Oblivious, Aroma Veil, a timely Mental Herb, or another applicable effect can change the result.

**Encore:** Normally forces repetition of the target's last eligible move for its next three turns. It fails without an eligible previous move or when the relevant PP/eligibility conditions are not met, and ends when the encored move runs out of PP. It can replace a move already selected but not yet executed. Encore adjusts the pending action for the repeated move's priority. Mental Herb’s effect on that pending priority is uncertain.

**Disable:** Normally disables the target's last eligible move for four turns. A move already selected can be prevented when its Disable check is reached. Its Champions before-move logic has a special exception for moves marked as unable to be used twice consecutively; the server's request and exact move rules must govern that edge case.

**Torment:** Prevents ordinary selection of the same move on successive turns while active. It does not mean the Pokémon forgets that move or loses its remaining PP.

**Imprison:** While its user remains active, opponents cannot use moves that the user also knows. The effect depends on the user's current known moves and continued presence, not on which one of those moves it selected this turn.

Restrictions can combine. A single available move can become unusable, leading to Struggle or another forced action supplied by the engine. Legal options at request time still need to be distinguished from successful execution after a faster opponent changes the state.

## Related articles

- [Move execution and failure](move-execution.md)
- [Move properties](move-properties.md)
- [Choice lock, charging, recharge, and first-turn moves](locks-charge-recharge.md)
- [Held-item interactions](item-interactions.md)

[Wiki home](../README.md) · [Directory](../directory.md)
