# Encore

`move:encore` · Target repeats its last move for its next 3 turns.

## Definition

For its next 3 turns, the target is forced to repeat its last move used. If the affected move runs out of PP, the effect ends. Fails if the target is already under this effect, if it has not made a move, if the move has 0 PP, or if the move is Assist, Blazing Torque, Combat Torque, Copycat, Dynamax Cannon, Encore, Magical Torque, Me First, Metronome, Mimic, Mirror Move, Nature Power, Noxious Torque, Sketch, Sleep Talk, Struggle, Transform, or Wicked Torque.

| Property | Resolved value |
| --- | --- |
| Type | Normal |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | 100% before applicable modifiers |
| Base priority | 0 |
| Target | normal — One adjacent Pokémon other than the user; in doubles this can be either opposing slot or the ally, subject to move-specific restrictions. |
| PP in Champions | 8 |
| Flags | bypasssub, failencore, metronome, mirror, protect, reflectable |

## Additional effect fields

```json
{
  "volatileStatus": "encore"
}
```

Encore can replace a pending move and adjust its priority. Uncertain interaction: Mental Herb’s effect on the pending move’s priority.

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Protect, Detect, and related personal protection](../articles/personal-protection.md), [Substitute](../articles/substitute.md), [Taunt, Encore, Disable, Torment, and Imprison](../articles/move-restrictions.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
