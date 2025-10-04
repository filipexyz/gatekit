import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Zap,
  LayoutDashboard,
  MessageSquare,
  Layers,
  Key,
  Users,
  CreditCard,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { cn, getInitials } from '../../lib/utils';

interface AppShellProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navigation: NavItem[] = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/app',
    },
    {
      label: 'Mensagens',
      icon: MessageSquare,
      href: '/app/messages',
    },
    {
      label: 'Plataformas',
      icon: Layers,
      href: '/app/platforms',
    },
    {
      label: 'Chaves de API',
      icon: Key,
      href: '/app/keys',
    },
    {
      label: 'Membros',
      icon: Users,
      href: '/app/members',
    },
    {
      label: 'Faturamento',
      icon: CreditCard,
      href: '/app/billing',
    },
    {
      label: 'Configurações',
      icon: Settings,
      href: '/app/settings',
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (href: string) => {
    if (href === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className={cn(
          'fixed inset-0 bg-gray-900/50 z-40 lg:hidden transition-opacity',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <Link to="/app" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">GateKit</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {profile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-4 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-700"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 lg:flex-none" />

            <div className="flex items-center gap-4">
              <div className="hidden lg:block text-sm text-gray-600">
                {profile?.role === 'system_admin' && (
                  <Link
                    to="/admin"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Painel Admin
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
