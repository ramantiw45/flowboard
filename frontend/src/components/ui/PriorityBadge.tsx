import type { CardData } from '../../types';
import { PRIORITY_META } from '../../utils/priority';


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
      className={`inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-micro font-bold uppercase tracking-wide ring-1 ring-inset ${meta.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

