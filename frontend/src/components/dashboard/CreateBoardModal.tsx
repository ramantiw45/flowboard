import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { createBoard } from '../../api/boardApi';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface CreateBoardModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (boardId: string) => void;
}

const STARTER_LISTS = ['To Do', 'In Progress', 'Done'];

export default function CreateBoardModal({ open, onClose, onCreated }: CreateBoardModalProps) {
  const { push } = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const board = await createBoard(name.trim());
      push(`Board "${board.name}" created`);
      setName('');
      onClose();
      onCreated(board.id);
    } catch (err) {
      push(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Create a new board"
      description="Boards hold your lists and cards, and sync live with everyone you invite."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Board name" required hint="Something short and recognizable, like a team or sprint name.">
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              autoFocus
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 42"
            />
          )}
        </Field>

        <div className="rounded-surface bg-slate-50 p-3.5 ring-1 ring-inset ring-slate-200/60">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            Included lists
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {STARTER_LISTS.map((list) => (
              <span
                key={list}
                className="rounded-control bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200/80"
              >
                {list}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            {busy ? 'Creating board…' : 'Create board'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

