/** Deterministic cover gradient per board, so each board feels distinct. */
const COVERS = [
  'from-indigo-500 via-blue-500 to-sky-400',
  'from-violet-600 via-purple-500 to-fuchsia-500',
  'from-emerald-500 via-teal-500 to-cyan-500',
  'from-orange-500 via-amber-500 to-yellow-400',
  'from-rose-500 via-pink-500 to-fuchsia-500',
  'from-blue-600 via-indigo-500 to-violet-500',
  'from-teal-500 via-emerald-500 to-lime-400',
  'from-slate-700 via-slate-600 to-slate-500',
];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function coverGradient(seed: string): string {
  return COVERS[hash(seed) % COVERS.length];
}

/** Accent bar colour for a kanban list, stable per list id. */
const LIST_ACCENTS = [
  'bg-indigo-400',
  'bg-sky-400',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-violet-400',
  'bg-teal-400',
  'bg-fuchsia-400',
];

export function listAccent(seed: string): string {
  return LIST_ACCENTS[hash(seed) % LIST_ACCENTS.length];
}
