import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import Button from '../ui/Button';

interface AddListFormProps {
  onCreate: (name: string) => Promise<void>;
}

export default function AddListForm({ onCreate }: AddListFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onCreate(trimmed);
      setName('');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Add another list"
        className="flex min-h-9 w-column shrink-0 items-center gap-2 rounded-surface bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-white/10 backdrop-blur transition hover:bg-white/10 hover:text-white"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add another list
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-column shrink-0 rounded-surface bg-slate-900/80 p-3 shadow-panel ring-1 ring-inset ring-white/10 backdrop-blur-md"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Enter list name..."
        aria-label="New list name"
        className="min-h-8 w-full rounded-control bg-white/10 px-2.5 py-2 text-sm text-white ring-1 ring-inset ring-brand-400 transition placeholder:text-slate-400"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" size="sm" loading={busy}>
          Add list
        </Button>
        <Button
          variant="glass"
          size="sm"
          aria-label="Cancel add list"
          title="Cancel add list"
          onClick={() => setOpen(false)}
          icon={<X className="h-4 w-4" aria-hidden="true" />}
        />
      </div>
    </form>
  );
}
