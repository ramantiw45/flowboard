import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  /** 'light' for white surfaces, 'dark' for the board canvas. */
  tone?: 'light' | 'dark';
}

export default function EmptyState({ icon: Icon, title, description, action, tone = 'light' }: EmptyStateProps) {
  const dark = tone === 'dark';
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-surface border-2 border-dashed px-6 py-14 text-center animate-fade-up ${
        dark ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-white'
      }`}
    >
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-surface ${
          dark ? 'bg-white/10 text-brand-300' : 'bg-brand-50 text-brand-600'
        }`}
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
      <p className={`mt-1 max-w-sm text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
