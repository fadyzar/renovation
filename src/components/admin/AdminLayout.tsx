import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, DollarSign, HeadphonesIcon,
  LogOut, Menu, X, ShieldCheck, Bell, UserCheck, MessageCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationDropdown } from '../shared/NotificationDropdown';

const NAV = [
  { label: 'Dashboard',      path: '/admin',                icon: LayoutDashboard },
  { label: 'Projects',       path: '/admin/projects',       icon: FolderOpen      },
  { label: 'Assigned',       path: '/admin/assigned',       icon: UserCheck       },
  { label: 'WhatsApp',       path: '/admin/whatsapp',       icon: MessageCircle   },
  { label: 'Verifications',  path: '/admin/verifications',  icon: ShieldCheck     },
  { label: 'Revenue',        path: '/admin/revenue',        icon: DollarSign      },
  { label: 'Support',        path: '/admin/support',        icon: HeadphonesIcon  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-gray-900 border-r border-gray-800 fixed inset-y-0 left-0 z-30">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">M.G.BIT</p>
            <p className="text-gray-400 text-xs mt-0.5">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 border-t border-gray-800 pt-4">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {profile?.full_name?.charAt(0) ?? 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{profile?.full_name}</p>
              <p className="text-gray-500 text-xs truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-xl text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative flex flex-col w-56 bg-gray-900 z-50">
            <div className="flex items-center justify-between px-5 py-5 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-white font-bold text-sm">Admin</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV.map(item => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive(item.path) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="px-3 pb-4 border-t border-gray-800 pt-4">
              <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 rounded-xl text-sm">
                <LogOut className="w-4 h-4" />Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 h-14">
          <button onClick={() => setOpen(true)} className="md:hidden text-gray-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden md:block">
            <p className="text-gray-400 text-xs">
              {NAV.find(n => isActive(n.path))?.label ?? 'Admin'}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <NotificationDropdown />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-gray-950 text-white">
          {children}
        </main>
      </div>
    </div>
  );
}
