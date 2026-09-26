import { Draggable } from '@hello-pangea/dnd';
import { AlignLeft } from 'lucide-react';
import type { CardData } from '../../types';
import { PRIORITY_META } from '../../utils/priority';
import PriorityBadge from '../ui/PriorityBadge';

interface CardItemProps {
  card: CardData;
  /** Position in the whole list, not in the rendered slice. */
  index: number;
  onOpen: (card: CardData) => void;
  /** Lets the virtual window measure a rendered card to learn the stride. */
  measureRef?: (node: HTMLElement | null) => void;
}

/**
 * The card's appearance, without the drag wrapper.
 *
 * Extracted so the virtualised drag clone can render the same thing. A clone
 * that looked even slightly different from the real card would be a visible
 * glitch the moment you started dragging in a long column.
 */
export function CardFace({ card, dragging = false }: { card: CardData; dragging?: boolean }) {
  const hasDescription = Boolean(card.description && card.description.trim());

  return (
    <div
      className={`group relative overflow-hidden rounded-xl bg-white p-3 shadow-card ring-1 ring-slate-900/5 ${
        dragging
          ? 'rotate-1 scale-[1.02] cursor-grabbing shadow-pop ring-2 ring-brand-400'
          : 'cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:shadow-card-hover'
      }`}
    >
      {/* Priority accent rail on the card's left edge */}
      <span
        aria-hidden="true"
        className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-full ${PRIORITY_META[card.priority].rail}`}
      />
      <p className="line-clamp-3 text-[13.5px] font-semibold leading-snug text-slate-800 transition group-hover:text-brand-700">
        {card.title}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <PriorityBadge priority={card.priority} />
        {hasDescription ? (
          <span className="flex items-center gap-1" title="Has description">
            <AlignLeft className="h-3.5 w-3.5 text-slate-400" />
          </span>
        ) : (
          <span
            className="font-mono text-[10px] text-slate-300 transition group-hover:text-slate-400"
            title={card.id}
          >
            #{card.id.slice(0, 8)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function CardItem({ card, index, onOpen, measureRef }: CardItemProps) {
  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          // Both the library's ref and the virtual window's measurement ref need
          // this node; the window's is optional and is a no-op for short lists.
          ref={(node) => {
            provided.innerRef(node);
            measureRef?.(node);
          }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpen(card)}
        >
          <CardFace card={card} dragging={snapshot.isDragging} />
        </div>
      )}
    </Draggable>
  );
}
