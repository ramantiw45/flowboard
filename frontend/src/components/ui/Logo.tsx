import { SquareKanban } from 'lucide-react';

/** Gradient brand mark + wordmark used in the top bar and auth screens. */
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
  const icon = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]';
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-[13px]' : 'text-[15px]';

  return (
    <span className="flex select-none items-center gap-2.5">
      <span
        className={`flex ${box} items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-md shadow-brand-600/25`}
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
