const PALETTE = [
  'from-indigo-500 to-violet-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-cyan-500',
  'from-violet-500 to-fuchsia-500',
  'from-blue-500 to-indigo-500',
  'from-teal-500 to-emerald-500',
];

function styleFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Two-letter initials so teammates are recognizable at a glance. */
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
    <div
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
          title={`${rest} more`}
          className={`flex ${SIZES[size]} items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 ring-2 ring-white`}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

