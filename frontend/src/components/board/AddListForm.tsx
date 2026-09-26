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
        className="flex w-[19rem] shrink-0 items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300 ring-1 ring-inset ring-white/10 backdrop-blur transition hover:bg-white/10 hover:text-white"
      >
        <Plus className="h-4 w-4" />
        Add another list
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-[19rem] shrink-0 rounded-2xl bg-slate-900/80 p-3 shadow-pop ring-1 ring-inset ring-white/10 backdrop-blur-md"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Enter list name..."
        aria-label="List name"
        className="w-full rounded-lg bg-white/10 px-2.5 py-2 text-sm text-white ring-1 ring-inset ring-brand-400 transition placeholder:text-slate-500"
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
          icon={<X className="h-4 w-4" />}
        />
      </div>
    </form>
  );
}
