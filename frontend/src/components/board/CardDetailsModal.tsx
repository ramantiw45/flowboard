import { useState, type FormEvent } from 'react';
import { AlignLeft, Check, History, Tag, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import PriorityBadge from '../ui/PriorityBadge';
import { Field, TextArea, TextInput } from '../ui/Field';
import { PRIORITIES, PRIORITY_META } from '../../utils/priority';
import { fullDate, timeAgo } from '../../utils/time';
import type { ActivityItem, CardData } from '../../types';

interface CardDetailsModalProps {
  card: CardData | null;
  activity: ActivityItem[];
  onClose: () => void;
  onSave: (cardId: string, patch: { title?: string; description?: string; priority?: CardData['priority'] }) => Promise<void>;
  onDelete: (cardId: string) => Promise<void>;
}

export default function CardDetailsModal({
  card,
  activity,
  onClose,
  onSave,
  onDelete,
}: CardDetailsModalProps) {
  const [title, setTitle] = useState(card?.title ?? '');
  const [description, setDescription] = useState(card?.description ?? '');
  const [priority, setPriority] = useState<CardData['priority']>(card?.priority ?? 'MEDIUM');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!card) return null;
  const cardActivity = activity.filter((a) => a.cardId === card.id);
  const dirty =
    title.trim() !== card.title || description !== (card.description ?? '') || priority !== card.priority;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(card.id, {
        title: title.trim() || card.title,
        description,
        priority,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(card.id);
      setConfirmDelete(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal
        open
        title={card.title}
        description={`Created ${timeAgo(card.createdAt)} · version ${card.version}`}
        onClose={onClose}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-surface bg-slate-50 px-3.5 py-2.5 ring-1 ring-inset ring-slate-200/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current</span>
              <PriorityBadge priority={card.priority} />
            </div>
            <div className="flex items-center gap-3 text-micro text-slate-400">
              <span className="flex items-center gap-1">
                <History className="h-3.5 w-3.5" />
                {cardActivity.length} event{cardActivity.length === 1 ? '' : 's'}
              </span>
              <span className="font-mono" title={card.id}>
                #{card.id.slice(0, 8)}
              </span>
            </div>
          </div>
          <Field label="Title" required>
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                placeholder="What needs to be done?"
              />
            )}
          </Field>

          <Field label="Description" hint="Plain text. Add context, links or acceptance criteria.">
            {({ id, describedBy }) => (
              <TextArea
                id={id}
                aria-describedby={describedBy}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a more detailed description…"
              />
            )}
          </Field>

          <div>
            <p className="label flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              Priority
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => {
                const meta = PRIORITY_META[p];
                const active = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPriority(p)}
                    className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                      active
                        ? `${meta.badge} ring-2`
                        : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                    {active && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {cardActivity.length > 0 && (
            <div>
              <p className="label flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-slate-400" />
                Card history
              </p>
              <ul className="thin-scrollbar max-h-40 space-y-1.5 overflow-y-auto rounded-surface bg-slate-50 p-2.5 ring-1 ring-inset ring-slate-200/60">
                {cardActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-xs text-slate-600">
                    <AlignLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                    <span className="flex-1">{a.message}</span>
                    <span className="shrink-0 text-slate-400" title={fullDate(a.at)}>
                      {timeAgo(a.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="danger-ghost"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setConfirmDelete(true)}
            >
              Delete card
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!dirty}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this card?"
        message={`"${card.title}" will be removed from the board for everyone. This cannot be undone.`}
        confirmLabel="Delete card"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

