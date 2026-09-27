import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClickOutside } from '../../hooks/useClickOutside';
import Avatar from '../ui/Avatar';

/** Avatar + initials dropdown holding the account actions. */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

  const signOut = () => {
    // Fire-and-forget: the context clears local state first, so the UI updates
    // immediately and the navigation is not held up by the server round-trip.
    void logout();
    navigate('/login');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={user?.displayName ? `Account menu for ${user.displayName}` : 'Account menu'}
        className="flex min-h-8 items-center gap-2 rounded-full p-0.5 pr-1 transition hover:bg-slate-100"
      >
        <Avatar name={user?.displayName ?? '?'} size="sm" ring={false} />
        <span className="hidden text-sm font-medium text-slate-700 sm:block">{user?.displayName}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-dropdown mt-2 w-64 overflow-hidden rounded-surface bg-white shadow-pop ring-1 ring-slate-200/80 animate-pop-in"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 px-3.5 py-3">
            <Avatar name={user?.displayName ?? '?'} size="md" ring={false} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user?.displayName}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <button
            role="menuitem"
            onClick={signOut}
            className="flex min-h-9 w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-danger-600 transition hover:bg-danger-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
