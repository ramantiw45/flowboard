/**
 * Avatar fill, two accents plus a neutral.
 *
 * An avatar is an identity marker, not decoration, so it uses the same two
 * accents as the rest of the product rather than a private eight-hue palette.
 */
const PALETTE = [
  'from-brand-500 to-brand-600',
  'from-sky-500 to-sky-600',
  'from-brand-600 to-sky-600',
  'from-slate-500 to-slate-600',
];

function styleFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** First and last initial, so a teammate is recognizable without a photo. */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = {
  xs: 'h-6 w-6 text-micro',
  sm: 'h-7 w-7 text-micro',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
} as const;

interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  title?: string;
  /** Set false inside dark panels/stacks where the ring color differs. */
  ring?: boolean;
  className?: string;
}

export default function Avatar({ name, size = 'md', title, ring = true, className = '' }: AvatarProps) {
  return (
    // role="img" is what makes the label reach assistive tech: aria-label on a
    // plain div is ignored, so the avatar announced as an unlabelled group.
    <div
      role="img"
      title={title ?? name}
      aria-label={title ?? name}
      className={`flex ${SIZES[size]} shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-bold tracking-tight text-white shadow-sm ${styleFor(name)} ${
        ring ? 'ring-2 ring-white' : ''
      } ${className}`}
    >
      {initialsFor(name)}
    </div>
  );
}

/** Overlapping avatar group with an overflow counter (e.g. "+3"). */
export function AvatarStack({
  items,
  max = 4,
  size = 'sm',
}: {
  items: { key: string; name: string; title?: string }[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((item) => (
        <Avatar key={item.key} name={item.name} title={item.title} size={size} />
      ))}
      {rest > 0 && (
        <div
          role="img"
          aria-label={`${rest} more`}
          title={`${rest} more`}
          className={`flex ${SIZES[size]} items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 ring-2 ring-white`}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

