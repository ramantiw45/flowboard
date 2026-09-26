import { useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import { Field, TextInput } from '../ui/Field';
import { inviteMember } from '../../api/boardApi';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import type { BoardMember } from '../../types';

interface InviteMemberModalProps {
  open: boolean;
  boardId: string;
  members: BoardMember[];
  onClose: () => void;
}

/** Role pill tones, ordered from highest to lowest privilege. */
const ROLE_STYLES: Record<BoardMember['role'], string> = {
  OWNER: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  ADMIN: 'bg-brand-50 text-brand-700 ring-brand-200/80',
  MEMBER: 'bg-slate-50 text-slate-600 ring-slate-200',
};

export default function InviteMemberModal({ open, boardId, members, onClose }: InviteMemberModalProps) {
  const { push } = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const member = await inviteMember(boardId, email.trim());
      push(`${member.displayName} added to the board`);
      setEmail('');
      onClose();
    } catch (err) {
      push(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Invite member"
      description="Invite a teammate to collaborate on this board in real time."
      size="md"
      onClose={onClose}
    >
      <div className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email address" hint="They must already have a FlowBoard account.">
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                autoFocus
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
              />
            )}
          </Field>

          <Button type="submit" loading={busy} icon={<UserPlus className="h-4 w-4" />} className="w-full">
            {busy ? 'Inviting…' : 'Send invite'}
          </Button>
        </form>

        {members.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Current members · {members.length}
            </h3>
            <ul className="thin-scrollbar max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-inset ring-slate-100">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={m.displayName} size="sm" title={m.email} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{m.displayName}</p>
                    <p className="truncate text-xs text-slate-500">{m.email}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${ROLE_STYLES[m.role]}`}
                  >
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
