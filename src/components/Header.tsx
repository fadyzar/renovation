import { useState } from 'react';
import { Settings, Volume2, Menu, X, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { NotificationDropdown } from './shared/NotificationDropdown';

export function Header() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isOwner = profile?.role === 'property_owner';
  const isContractor = profile?.role === 'contractor';
  const isAdmin = profile?.role === 'admin';

  const navItems = [
    { label: 'Dashboard', path: isAdmin ? '/admin' : '/dashboard' },
    ...(isContractor
      ? [{ label: 'Available Projects', path: '/projects' }]
      : isOwner
      ? [{ label: 'Project History', path: '/project-history' }]
      : []
    ),
    ...(isAdmin ? [] : [{ label: 'Messages', path: '/messages' }]),
    ...(isAdmin ? [] : [{ label: 'My Profile', path: '/profile' }]),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <img src={logo} alt="M.G.BIT Logo" className="h-5 w-auto" />
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin
              </button>
            )}
            <NotificationDropdown />

            <button
              onClick={() => navigate('/account-settings')}
              className="hidden sm:block p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button className="hidden sm:block p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Volume2 className="w-5 h-5" />
            </button>

            <button
              onClick={signOut}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 hover:shadow-lg transition-shadow"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name || 'Profile'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-sm font-bold">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <nav className="px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                navigate('/account-settings');
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Account Settings</span>
            </button>
            <button
              onClick={() => {
                signOut();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
