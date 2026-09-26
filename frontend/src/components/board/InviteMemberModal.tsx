import { useState, type FormEvent } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import { Field, SelectInput, TextInput } from '../ui/Field';
import { changeMemberRole, inviteMember } from '../../api/boardApi';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import type { AssignableRole, BoardMember } from '../../types';

interface InviteMemberModalProps {
  open: boolean;
  boardId: string;
  members: BoardMember[];
  /** The signed-in user; role controls are only rendered for privileged callers. */
  currentUserId: string | null;
  onClose: () => void;
}

/** Role pill tones, ordered from highest to lowest privilege. */
const ROLE_STYLES: Record<BoardMember['role'], string> = {
  OWNER: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  ADMIN: 'bg-brand-50 text-brand-700 ring-brand-200/80',
  MEMBER: 'bg-slate-50 text-slate-600 ring-slate-200',
};

const ROLE_HINTS: Record<AssignableRole, string> = {
  ADMIN: 'Can manage lists and invite other members.',
  MEMBER: 'Can create, edit and move cards.',
};

export default function InviteMemberModal({
  open,
  boardId,
  members,
  currentUserId,
  onClose,
}: InviteMemberModalProps) {
  const { push } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('MEMBER');
  const [busy, setBusy] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Mirrors BoardAccessGuard: only an OWNER or ADMIN may invite, and only the
  // OWNER may mint an ADMIN. The backend enforces both regardless; the UI
  // simply avoids offering an action that is guaranteed to 403.
  const me = members.find((m) => m.userId === currentUserId);
  const isOwner = me?.role === 'OWNER';
  const canInvite = isOwner || me?.role === 'ADMIN';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const member = await inviteMember(boardId, email.trim(), role);
      push(`${member.displayName} added as ${member.role}`);
      setEmail('');
      setRole('MEMBER');
      onClose();
    } catch (err) {
      push(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (member: BoardMember, next: AssignableRole) => {
    if (member.role === next) return;
    setPendingUserId(member.userId);
    try {
      const updated = await changeMemberRole(boardId, member.userId, next);
      push(`${updated.displayName} is now ${updated.role}`);
    } catch (err) {
      // A rejected change simply leaves the previous role in place; the
      // authoritative list arrives via the board refetch / MEMBER_UPDATED push.
      push(apiError(err), 'error');
    } finally {
      setPendingUserId(null);
    }
  };

  return (
    <Modal
      open={open}
      title="Members"
      description="Invite teammates to collaborate on this board in real time."
      size="md"
      onClose={onClose}
    >
      <div className="space-y-5">
        {canInvite ? (
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

            <Field label="Role" hint={ROLE_HINTS[role]}>
              {({ id, describedBy }) => (
                <SelectInput
                  id={id}
                  aria-describedby={describedBy}
                  value={role}
                  onChange={(e) => setRole(e.target.value as AssignableRole)}
                >
                  <option value="MEMBER">Member</option>
                  {isOwner && <option value="ADMIN">Admin</option>}
                </SelectInput>
              )}
            </Field>

            <Button type="submit" loading={busy} icon={<UserPlus className="h-4 w-4" />} className="w-full">
              {busy ? 'Inviting…' : 'Send invite'}
            </Button>
          </form>
        ) : (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 ring-1 ring-inset ring-slate-100">
            Only board admins can invite new members.
          </p>
        )}

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
                    <p className="truncate text-sm font-medium text-slate-900">
                      {m.displayName}
                      {m.userId === currentUserId && <span className="text-slate-400"> (you)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{m.email}</p>
                  </div>
                  {isOwner && m.role !== 'OWNER' ? (
                    <>
                      <label className="sr-only" htmlFor={`role-${m.userId}`}>
                        Role for {m.displayName}
                      </label>
                      <SelectInput
                        id={`role-${m.userId}`}
                        className="w-28 shrink-0 py-1 text-xs"
                        value={m.role}
                        disabled={pendingUserId === m.userId}
                        onChange={(e) => void handleRoleChange(m, e.target.value as AssignableRole)}
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                      </SelectInput>
                    </>
                  ) : (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${ROLE_STYLES[m.role]}`}
                    >
                      {m.role}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {isOwner && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                You own this board, so you can promote or demote admins. The owner role is fixed.
              </p>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
