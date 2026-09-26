import { PanelRightClose, PanelRightOpen, UserPlus } from 'lucide-react';
import { AvatarStack } from '../ui/Avatar';
import Button from '../ui/Button';
import ConnectionStatus from '../ui/ConnectionStatus';
import type { BoardMember } from '../../types';

interface BoardHeaderProps {
  boardName: string;
  members: BoardMember[];
  connected: boolean;
  feedOpen: boolean;
  onToggleFeed: () => void;
  onInvite: () => void;
}

export default function BoardHeader({
  boardName,
  members,
  connected,
  feedOpen,
  onToggleFeed,
  onInvite,
}: BoardHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950/40 px-3 py-2.5 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <h1 className="min-w-0 truncate text-[15px] font-bold tracking-tight text-white">{boardName}</h1>
        <span className="shrink-0">
          <ConnectionStatus connected={connected} tone="dark" />
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div title={`${members.length} member(s)`} className="hidden items-center sm:flex">
          <AvatarStack
            size="sm"
            max={4}
            items={members.map((m) => ({ key: m.userId, name: m.displayName, title: m.email }))}
          />
        </div>

        <Button variant="glass" size="sm" onClick={onInvite} icon={<UserPlus className="h-4 w-4" />}>
          Invite
        </Button>

        <Button
          variant="glass"
          size="sm"
          aria-pressed={feedOpen}
          aria-label="Activity"
          title={feedOpen ? 'Hide activity feed' : 'Show activity feed'}
          className={feedOpen ? 'bg-brand-500/25 text-white ring-brand-400/40' : ''}
          icon={feedOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          onClick={onToggleFeed}
        >
          <span className="hidden sm:inline">Activity</span>
        </Button>
      </div>
    </header>
  );
}
