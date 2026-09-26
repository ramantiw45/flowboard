import type { ReactNode } from 'react';
import { ArrowDownUp, Radio, Users } from 'lucide-react';
import Logo from '../ui/Logo';

const FEATURES = [
  {
    icon: Radio,
    title: 'Live multi-user sync',
    body: 'Every card move, edit and reorder streams to your team over WebSockets in milliseconds.',
  },
  {
    icon: ArrowDownUp,
    title: 'Frictionless drag & drop',
    body: 'Optimistic updates keep dragging instant, with automatic conflict reconciliation on write.',
  },
  {
    icon: Users,
    title: 'Built for teams',
    body: 'Invite teammates to a board and follow a live, attributed activity trail of what changed.',
  },
];

/** Shared marketing-quality shell for the sign-in and sign-up screens. */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth-canvas flex min-h-screen">
      {/* ---------- Brand / value panel ---------- */}
      <div className="relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative">
          <Logo tone="dark" size="lg" />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[2.15rem] font-extrabold leading-[1.15] tracking-tight text-white">
            Where your team&apos;s work
            <span className="block bg-gradient-to-r from-brand-300 via-violet-300 to-sky-300 bg-clip-text text-transparent">
              moves in real time.
            </span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            Plan sprints, track delivery and watch boards update live as your team works — no refreshing, no
            conflicts.
          </p>

          <ul className="mt-9 space-y-5">
            {FEATURES.map(({ icon: Icon, title: t, body }) => (
              <li key={t} className="flex gap-3.5">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-300 ring-1 ring-inset ring-white/10 backdrop-blur">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} FlowBoard</p>
      </div>

      {/* ---------- Form panel ---------- */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-[25rem] animate-fade-up">
          <div className="mb-8 lg:hidden">
            <Logo size="md" />
          </div>

          <div className="mb-7">
            <h1 className="text-[1.6rem] font-extrabold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
          </div>

          <div className="card-surface p-6">{children}</div>

          <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
        </div>
      </div>
    </div>
  );
}
