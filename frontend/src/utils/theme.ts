/**
 * Cover tint per board.
 *
 * Two hues and two neutrals, not a hue per hue. A Kanban board puts this
 * palette next to the priority badges, the column accents and the avatars, so
 * a wider spread reads as noise rather than as identity: the eye cannot tell
 * a decorative colour from a meaningful one. `sky` sits next to `brand` on the
 * wheel on purpose - an analogous second accent reads as one decision, where a
 * complement reads as a sticker sheet.
 */
const COVERS = [
  'from-brand-600 to-brand-400',
  'from-brand-700 to-brand-500',
  'from-sky-600 to-sky-400',
  'from-slate-700 to-slate-500',
];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function coverGradient(seed: string): string {
  return COVERS[hash(seed) % COVERS.length];
}

/**
 * Accent bar for a kanban list, stable per list id.
 *
 * Tints of the same two accents rather than eight distinct hues. The dot on
 * each list header has to be identifiable at a glance without competing with
 * the priority colours on the cards beneath it.
 */
const LIST_ACCENTS = ['bg-brand-400', 'bg-sky-400', 'bg-brand-300', 'bg-sky-300'];

export function listAccent(seed: string): string {
  return LIST_ACCENTS[hash(seed) % LIST_ACCENTS.length];
}
