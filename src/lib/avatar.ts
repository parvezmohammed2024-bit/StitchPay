export function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'W';
  const clean = name.trim();
  if (!clean) return 'W';
  
  // Remove common prefix titles if present
  const words = clean
    .replace(/^(md\.|mr\.|mrs\.|ms\.|dr\.)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'W';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const COLOR_PALETTE = [
  'bg-indigo-600 text-white border-indigo-500/30',
  'bg-emerald-600 text-white border-emerald-500/30',
  'bg-amber-600 text-white border-amber-500/30',
  'bg-rose-600 text-white border-rose-500/30',
  'bg-purple-600 text-white border-purple-500/30',
  'bg-teal-600 text-white border-teal-500/30',
  'bg-fuchsia-600 text-white border-fuchsia-500/30',
  'bg-sky-600 text-white border-sky-500/30',
  'bg-violet-600 text-white border-violet-500/30',
  'bg-blue-600 text-white border-blue-500/30',
  'bg-cyan-600 text-white border-cyan-500/30',
  'bg-orange-600 text-white border-orange-500/30',
];

export function getDeterministicColor(name?: string | null): string {
  if (!name) return COLOR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
}
