import { SquareKanban } from 'lucide-react';

export default function Logo({
  size = 'md',
  withWordmark = true,
  tone = 'light',
}: {
  size?: 'sm' | 'md' | 'lg';
  withWordmark?: boolean;
  tone?: 'light' | 'dark';
}) {
  const box = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-11 w-11' : 'h-8 w-8';
  const icon = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-4.5 w-4.5';
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <span className="flex select-none items-center gap-2.5">
      {/*
       * Solid, not a gradient: this tile is where the brand colour is spent, so
       * a second hue and a glow shadow here only dilute it.
       */}
      <span
        className={`flex ${box} items-center justify-center rounded-surface bg-brand-600 text-white shadow-card`}
      >
        <SquareKanban className={icon} strokeWidth={2.25} />
      </span>
      {withWordmark && (
        <span
          className={`font-extrabold tracking-tight ${text} ${
            tone === 'dark' ? 'text-white' : 'text-slate-900'
          }`}
        >
          Flow<span className="text-brand-500">Board</span>
        </span>
      )}
    </span>
  );
}
