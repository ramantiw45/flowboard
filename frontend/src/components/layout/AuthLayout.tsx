import type { ReactNode } from 'react';
import Logo from '../ui/Logo';

/**
 * Shell for the sign-in and sign-up screens.
 *
 * The left panel is a product statement, not a landing page. It was carrying a
 * headline, a paragraph, three feature blurbs and a copyright line, which made
 * signing in feel like browsing; it now says what the product is and stops.
 */
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
      <div className="relative hidden w-5/12 max-w-2xl flex-col justify-between overflow-hidden p-12 lg:flex">
        <Logo tone="dark" size="lg" />

        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white">
            Your team&apos;s boards, updating live.
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-400">
            Every card move, edit and reorder is streamed to everyone on the board as it happens.
          </p>
        </div>

        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} FlowBoard</p>
      </div>

      {/* ---------- Form panel ---------- */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 lg:hidden">
            <Logo size="md" />
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
          </div>

          <div className="card-surface p-6">{children}</div>

          <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
        </div>
      </div>
    </div>
  );
}
