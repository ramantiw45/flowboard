interface ConnectionStatusProps {
  connected: boolean;
  /** 'light' renders for the white top bar; 'dark' for the board header. */
  tone?: 'light' | 'dark';
  withLabel?: boolean;
}

/**
 * Live-sync indicator: a pulsing dot communicates streaming state better
 * than text alone, and the label explains it on hover.
 */
export default function ConnectionStatus({ connected, tone = 'light', withLabel = true }: ConnectionStatusProps) {
  const label = connected ? 'Live sync' : 'Reconnecting';
  return (
    <span
      title={connected ? 'Connected — changes sync in real time' : 'Connection lost — retrying…'}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${
        connected
          ? tone === 'dark'
            ? 'bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/25'
            : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100'
          : tone === 'dark'
            ? 'bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/25'
            : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100'
      }`}
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping-soft rounded-full ${
              connected ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`}
        />
      </span>
      {withLabel && label}
    </span>
  );
}
