import { Loader2 } from 'lucide-react';

export default function Loader({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}
