# Roost

`move:roost` · Heals 50% HP. Flying-type removed 'til turn ends.

## Definition

The user restores 1/2 of its maximum HP, rounded half up. If the user is not Terastallized, until the end of the turn Flying-type users lose their Flying type and pure Flying-type users become Normal type. Does nothing if the user's HP is full.

| Property | Resolved value |
| --- | --- |
| Type | Flying |
| Category | Status |
| Listed base power | 0 (0 can mean status or an effect-specific damage rule) |
| Accuracy | No ordinary accuracy check |
| Base priority | 0 |
| Target | self — The user. |
| PP in Champions | 8 |
| Flags | heal, metronome, snatch |

## Additional effect fields

```json
{
  "self": {
    "volatileStatus": "roost"
  },
  "heal": [
    1,
    2
  ]
}
```

## Related mechanics

[Action order](../articles/action-order.md), [Move execution and failure](../articles/move-execution.md), [Targets and field positions](../articles/targets-and-positions.md), [Move properties](../articles/move-properties.md), [Safeguard, healing, and healing prevention](../articles/healing-and-safeguard.md). Load those relevant to the current state.

[Wiki home](../README.md) · [Directory](../directory.md)
