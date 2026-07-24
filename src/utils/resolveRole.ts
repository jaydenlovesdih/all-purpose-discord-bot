import { Guild, Role } from 'discord.js';
import { levenshtein } from './fuzzy.js';

/**
 * Resolve a role from mention, snowflake ID, exact name, or closest name match.
 */
export function resolveRole(guild: Guild, input: string): Role | null {
  const raw = input.trim();
  if (!raw) return null;

  const idMatch = raw.match(/^<@&(\d+)>$|^(\d{17,20})$/);
  if (idMatch) {
    const id = idMatch[1] ?? idMatch[2];
    return guild.roles.cache.get(id) ?? null;
  }

  const q = raw.toLowerCase();
  const roles = [...guild.roles.cache.values()].filter((r) => r.id !== guild.id);

  const exact = roles.find((r) => r.name.toLowerCase() === q);
  if (exact) return exact;

  const starts = roles.filter((r) => r.name.toLowerCase().startsWith(q));
  if (starts.length) {
    starts.sort(
      (a, b) =>
        a.name.length - b.name.length ||
        levenshtein(q, a.name.toLowerCase()) - levenshtein(q, b.name.toLowerCase()),
    );
    return starts[0];
  }

  const includes = roles.filter((r) => r.name.toLowerCase().includes(q));
  if (includes.length) {
    includes.sort(
      (a, b) =>
        levenshtein(q, a.name.toLowerCase()) - levenshtein(q, b.name.toLowerCase()) ||
        a.name.length - b.name.length,
    );
    return includes[0];
  }

  const scored = roles
    .map((role) => ({
      role,
      score: levenshtein(q, role.name.toLowerCase()),
    }))
    .sort((a, b) => a.score - b.score || a.role.name.length - b.role.name.length);

  const best = scored[0];
  if (!best) return null;

  const maxDist = Math.max(2, Math.floor(q.length / 2) + 1);
  return best.score <= maxDist ? best.role : null;
}
