import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}

