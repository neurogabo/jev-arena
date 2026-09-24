/** Randomization assigns only a validated six-Pokémon team, never Jev's moves or leads. */
export function resolveTeamSelection(catalog, value, random = Math.random) {
  const enabled = catalog.filter(team => team.enabled);
  if (!enabled.length) throw new Error('No compatible teams are available.');
  if (value !== 'random') {
    const selected = enabled.find(team => team.id === value);
    if (!selected) throw new Error('That team is unavailable. Please choose another.');
    return selected;
  }
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid random draw.');
  return enabled[Math.floor(draw * enabled.length)];
}
export function teamLabel(team) {
  const event = team.event?.startsWith('worlds-2026') ? 'Worlds 2026' : team.event === 'baltimore-2027' ? 'Baltimore 2027' : team.event || 'Tournament';
  return team.player ? team.player + ' · ' + event : team.label;
}
