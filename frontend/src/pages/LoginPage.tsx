import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AtSign, Lock, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiError } from '../api/client';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Field';

export default function LoginPage() {
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const expired = params.get('expired') === '1';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      push('Welcome back!');
      navigate('/boards');
    } catch (err) {
      push(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Pick up right where your team left off."
      footer={
        <>
          New to FlowBoard?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
        </>
      }
    >
      {expired && (
        <div className="mb-5 flex items-start gap-2.5 rounded-control bg-warning-50 px-3 py-2.5 text-sm text-warning-800 ring-1 ring-inset ring-warning-200">
          <span aria-hidden>⏱</span>
          <span>Your session expired — please sign in again.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <Field label="Password" required>
          {({ id, describedBy }) => (
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9"
              />
            </div>
          )}
        </Field>

        <Button type="submit" loading={busy} className="w-full py-2.5" icon={<LogIn className="h-4 w-4" />}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}

