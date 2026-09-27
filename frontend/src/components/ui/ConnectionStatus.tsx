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
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-micro font-semibold ${
        connected
          ? tone === 'dark'
            ? 'bg-success-400/10 text-success-300 ring-1 ring-inset ring-success-400/25'
            : 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-100'
          : tone === 'dark'
            ? 'bg-warning-400/10 text-warning-300 ring-1 ring-inset ring-warning-400/25'
            : 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-100'
      }`}
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping-soft rounded-full ${
              connected ? 'bg-success-400' : 'bg-warning-400'
            }`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-success-500' : 'bg-warning-500'}`}
        />
      </span>
      {withLabel && label}
    </span>
  );
}
