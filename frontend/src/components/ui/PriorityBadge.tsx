import type { CardData } from '../../types';
import { PRIORITY_META } from '../../utils/priority';

/** Compact pill used on cards and in the details header. */
export default function PriorityBadge({
  priority,
  className = '',
}: {
  priority: CardData['priority'];
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${meta.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

