# Requests and simultaneous commands

Simultaneous commands, move requests, team selection, and replacement decisions within a turn.

## Reference text

Both players normally choose commands before seeing the opponent's commands for that turn. The commands then execute in the battle's action order. A Pokémon usually has one chosen action in a turn; an effect can explicitly alter, repeat, cancel, or replace an action.

A request may instead ask for team selection, a forced replacement, or a replacement after a pivot move. Such a request is a separate decision point and may occur during an unfinished turn. A Pokémon entering through a replacement does not inherit the departing Pokémon's unexecuted ordinary attack.

The state and candidate list belong to one request. Previously selected actions, targets, and available switches can become stale after a knockout, switch, revealed restriction, or other state change. A fresh request needs a fresh decision from its supplied options.

## Related articles

- [Action order](action-order.md)
- [Switching, pivots, and replacements](switches-and-replacements.md)

[Wiki home](../README.md) · [Directory](../directory.md)
