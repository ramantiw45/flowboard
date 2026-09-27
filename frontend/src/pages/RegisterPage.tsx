import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AtSign, Lock, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiError } from '../api/client';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Field';

export default function RegisterPage() {
  const { signup } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // Inline rather than toast-only: see LoginPage. The duplicate-address case
  // still navigates, so it keeps its toast, but a failure the user can act on
  // here has to be attached to the form.
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const created = await signup(email, displayName, password);
      if (created) {
        push('Account created — welcome to FlowBoard!');
        navigate('/boards');
      } else {
        // The server answers 201 either way so it cannot be used to discover
        // which addresses are registered. Do not claim the account was made.
        push(
          'If that email was free, your account is ready — otherwise it already exists. Try signing in.',
          'error'
        );
        navigate('/login');
      }
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free to start. Invite your team once your first board is live."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <p
            role="alert"
            className="rounded-control bg-danger-50 px-3 py-2.5 text-sm font-medium text-danger-700 ring-1 ring-inset ring-danger-200"
          >
            {formError}
          </p>
        )}

        <Field label="Full name" required hint="Shown to teammates on cards and in the activity feed.">
          {({ id, describedBy }) => (
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <TextInput
                id={id}
                aria-describedby={describedBy}
                aria-invalid={formError ? true : undefined}
                type="text"
                required
                minLength={2}
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ada Lovelace"
                className="pl-9"
              />
            </div>
          )}
        </Field>

        <Field label="Email" required>
          {({ id, describedBy }) => (
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-9"
              />
            </div>
          )}
        </Field>

        <Field label="Password" required hint="At least 8 characters.">
          {({ id, describedBy }) => (
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9"
              />
            </div>
          )}
        </Field>

        <Button type="submit" loading={busy} className="w-full py-2.5" icon={<Sparkles className="h-4 w-4" />}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}

