import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../context/WebSocketContext';
import { getBoards } from '../../api/boardApi';
import type { BoardSummary } from '../../types';
import Logo from '../ui/Logo';
import ConnectionStatus from '../ui/ConnectionStatus';
import BoardSwitcher from './BoardSwitcher';
import UserMenu from './UserMenu';

export default function Navbar() {
  const { connected } = useWebSocket();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  // Reload the picker's list whenever the route changes so newly created
  // boards appear immediately.
  useEffect(() => {
    let cancelled = false;
    getBoards()
      .then((b) => !cancelled && setBoards(b))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const currentBoardId = location.pathname.startsWith('/boards/')
    ? location.pathname.split('/')[2]
    : undefined;

  return (
    <header className="z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5">
        <Link
          to="/boards"
          aria-label="Go to my boards"
          onClick={(e) => {
            if (currentBoardId === undefined) e.preventDefault();
            else navigate('/boards');
          }}
          className="rounded-lg p-1 transition hover:opacity-80"
        >
          <Logo size="sm" />
        </Link>

        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />

        <BoardSwitcher boards={boards} currentBoardId={currentBoardId} />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <ConnectionStatus connected={connected} />
        <UserMenu />
      </div>
    </header>
  );
}

