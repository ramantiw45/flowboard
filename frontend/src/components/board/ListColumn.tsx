import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { type DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { Droppable } from '@hello-pangea/dnd';
import { Check, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { CardData, ListData } from '../../types';
import { useClickOutside } from '../../hooks/useClickOutside';
import { listAccent } from '../../utils/theme';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import { TextArea } from '../ui/Field';
import CardItem from './CardItem';

interface ListColumnProps {
  list: ListData;
  /** Drag handle props â€” attached to the grip only, never to a <button>. */
  headerDragHandleProps?: DraggableProvidedDragHandleProps | null;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onRenameList: (listId: string, name: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onOpenCard: (card: CardData) => void;
  /** Keyboard equivalent of the column drag (arrow keys on the grip). */
  onNudgeList: (listId: string, direction: -1 | 1) => Promise<void>;
}

export default function ListColumn({
  list,
  headerDragHandleProps,
  onAddCard,
  onRenameList,
  onDeleteList,
  onOpenCard,
  onNudgeList,
}: ListColumnProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(list.name);
  const [adding, setAdding] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nudging, setNudging] = useState(false);
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenuOpen(false), menuOpen);

  const cancelRename = () => {
    setRenameValue(list.name);
    setRenaming(false);
  };

  const submitRename = async (e: FormEvent) => {
    e.preventDefault();
    const name = renameValue.trim();
    if (name && name !== list.name) await onRenameList(list.id, name);
    setRenaming(false);
  };

  const submitCard = async (e: FormEvent) => {
    e.preventDefault();
    const title = newCardTitle.trim();
    if (!title) return;
    await onAddCard(list.id, title);
    setNewCardTitle('');
  };

  // Keyboard reordering: the column drag is mouse-only, so the grip also
  // supports ArrowLeft/ArrowRight for parity with the visual affordance.
  const onGripKeyDown = async (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    if (nudging) return;
    setNudging(true);
    try {
      await onNudgeList(list.id, e.key === 'ArrowLeft' ? -1 : 1);
    } finally {
      setNudging(false);
    }
  };

  return (
    // NOTE: deliberately no `backdrop-filter` and no `overflow: hidden` here.
    // `backdrop-filter` becomes the containing block for the position:fixed
    // drag preview that @hello-pangea/dnd renders, which offsets the dragged
    // card from the cursor; `overflow: hidden` then clips it. Both were
    // measured at a ~115px vertical offset during real drags.
    <div className="flex h-full max-h-full w-[19rem] shrink-0 flex-col rounded-2xl bg-slate-900/90 shadow-pop ring-1 ring-inset ring-white/10">
      {/* Header. The drag handle is the grip only â€” the library refuses to
          start a drag when the press lands on a <button>. */}
      <div className="flex items-center gap-1.5 px-2 py-2.5">
        {!renaming && (
          <div
            {...headerDragHandleProps}
            role="button"
            tabIndex={0}
            aria-label={`Reorder ${list.name}. Use left and right arrow keys to move.`}
            onKeyDown={onGripKeyDown}
            className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-slate-500 transition hover:bg-white/10 hover:text-slate-200 focus-visible:text-slate-200 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </div>
        )}


        {renaming ? (
          <form onSubmit={submitRename} className="flex min-w-0 flex-1 items-center gap-1.5">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && cancelRename()}
              aria-label="List name"
              className="min-w-0 flex-1 rounded-md bg-white/10 px-2 py-1 text-sm text-white ring-1 ring-inset ring-brand-400 transition placeholder:text-slate-500"
            />
            <Button
              type="submit"
              variant="glass"
              size="sm"
              aria-label="Save"
              title="Save"
              icon={<Check className="h-4 w-4" />}
            />
            <Button
              variant="glass"
              size="sm"
              aria-label="Cancel rename"
              title="Cancel rename"
              onClick={cancelRename}
              icon={<X className="h-4 w-4" />}
            />
          </form>
        ) : (
          <>
            <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${listAccent(list.id)}`} />
            <button
              onClick={() => { setRenameValue(list.name); setRenaming(true); }}
              className="min-w-0 flex-1 truncate text-left text-[13px] font-bold text-white transition hover:text-brand-300"
              title="Rename list"
            >
              {list.name}
            </button>
            <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-slate-400">
              {list.cards.length}
            </span>
            <div ref={menuRef} className="relative shrink-0">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={`Actions for ${list.name}`}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={`rounded-lg p-1.5 transition ${menuOpen ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div role="menu" className="menu absolute right-0 top-[calc(100%+0.4rem)] z-30 w-40">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setRenameValue(list.name); setRenaming(true); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4 text-slate-400" />
                    Rename
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete list
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* This Droppable is the ONLY vertical scroll parent in the column.
          `min-h-0` lets it shrink inside the flex column so long lists scroll
          internally instead of stretching the whole board. */}
      <Droppable droppableId={list.id} type="CARD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`thin-scrollbar-light min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2 ${
              snapshot.isDraggingOver ? 'rounded-lg bg-brand-500/10 ring-2 ring-inset ring-brand-400/40' : ''
            }`}
          >
            {list.cards.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/15 px-3 py-6 text-center text-xs text-slate-500">
                Drop cards here
              </div>
            )}
            {list.cards.map((card, index) => (
              <CardItem key={card.id} card={card} index={index} onOpen={onOpenCard} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add card */}
      <div className="shrink-0 p-2">
        {adding ? (
          <form onSubmit={submitCard} className="rounded-xl bg-slate-950/50 p-2 ring-1 ring-inset ring-white/10">
            <TextArea
              autoFocus
              rows={2}
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitCard(e); } }}
              placeholder="Enter a title for this card..."
              className="bg-white/10 text-white placeholder:text-slate-500 ring-1 ring-inset ring-brand-400"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button type="submit" size="sm">
                Add card
              </Button>
              <Button
                variant="glass"
                size="sm"
                aria-label="Cancel add card"
                title="Cancel add card"
                onClick={() => { setAdding(false); setNewCardTitle(''); }}
                icon={<X className="h-4 w-4" />}
              />
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Plus className="h-4 w-4" />
            Add a card
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete list "${list.name}"?`}
        message={`Deleting "${list.name}" removes all of its cards. This cannot be undone.`}
        confirmLabel="Delete list"
        onConfirm={() => { setConfirmOpen(false); void onDeleteList(list.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
