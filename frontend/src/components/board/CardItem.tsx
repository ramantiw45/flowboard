import { Draggable } from '@hello-pangea/dnd';
import { AlignLeft } from 'lucide-react';
import type { CardData } from '../../types';
import { PRIORITY_META } from '../../utils/priority';
import PriorityBadge from '../ui/PriorityBadge';

interface CardItemProps {
  card: CardData;
  index: number;
  onOpen: (card: CardData) => void;
}

export default function CardItem({ card, index, onOpen }: CardItemProps) {
  const hasDescription = Boolean(card.description && card.description.trim());

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpen(card)}
          className={`group relative overflow-hidden rounded-xl bg-white p-3 shadow-card ring-1 ring-slate-900/5 ${
            snapshot.isDragging
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
      )}
    </Draggable>
  );
}
