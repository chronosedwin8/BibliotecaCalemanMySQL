import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Book,
  RefreshCw,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Search,
  TrendingUp,
  Microscope,
  BookMarked,
} from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';
import logoUrl from '../../../logo.avif';

const Layout: React.FC = () => {
  const { signOut, profile } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems: { title: string; icon: React.ReactNode; path: string; to?: string; roles: string[] }[] = [
    { title: 'Dashboard', icon: <BarChart3 className="w-5 h-5" />, path: '/dashboard', roles: ['admin'] },
    { title: 'Catálogo', icon: <Search className="w-5 h-5" />, path: '/catalog', roles: ['admin', 'teacher', 'student'] },
    { title: 'Investigación', icon: <Microscope className="w-5 h-5" />, path: '/research', roles: ['admin', 'teacher', 'student'] },
    { title: 'Mis Reservas', icon: <BookMarked className="w-5 h-5" />, path: '/reservas', roles: ['teacher', 'student'] },
    { title: 'Mi Panel', icon: <BarChart3 className="w-5 h-5" />, path: '/student', roles: ['student', 'teacher'] },
    { title: 'Libros', icon: <Book className="w-5 h-5" />, path: '/books', roles: ['admin'] },
    { title: 'Préstamos', icon: <RefreshCw className="w-5 h-5" />, path: '/loans', roles: ['admin'] },
    { title: 'Reservas', icon: <BookMarked className="w-5 h-5" />, path: '/loans', to: '/loans?tab=reservas', roles: ['admin'] },
    { title: 'Usuarios', icon: <Users className="w-5 h-5" />, path: '/users', roles: ['admin'] },
    { title: 'Estadísticas', icon: <TrendingUp className="w-5 h-5" />, path: '/stats', roles: ['admin'] },
    { title: 'Configuración', icon: <Settings className="w-5 h-5" />, path: '/settings', roles: ['admin'] },
  ];

  const userRole = profile?.role ?? 'student';
  const visibleItems = menuItems.filter((item) => item.roles.includes(userRole));

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#F4F7FB] dark:bg-gray-900 w-full">
      {/* Sidebar — azul institucional */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-[#21529B] border-r border-[#1A4280]">
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
            <img src={logoUrl} alt="BiblioCalem" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">BiblioCalem</h1>
            <p className="text-[10px] text-blue-200 uppercase tracking-wider">Biblioteca Escolar</p>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path &&
              (!item.to || location.search === `?tab=${item.to?.split('tab=')[1] ?? ''}`);
            return (
              <Link
                key={item.to ?? item.path}
                to={item.to ?? item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-blue-200'}>
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.title}</span>
                {isActive && (
                  <span className="ml-auto w-1 h-4 rounded-full bg-[#F0CE2D]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer — usuario + salir */}
        <div className="px-3 py-3 border-t border-white/10 space-y-1">
          <div className="px-3 py-2 rounded-lg bg-white/8">
            <p className="text-xs font-semibold text-white truncate">{profile?.full_name || 'Usuario'}</p>
            <p className="text-[10px] text-blue-200 capitalize">{profile?.role || 'Estudiante'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-blue-200 hover:bg-white/10 hover:text-white rounded-lg transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 shadow-sm">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            {location.pathname.substring(1) || 'Dashboard'}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800 dark:text-white">{profile?.full_name || 'Usuario'}</p>
              <p className="text-xs text-gray-400 capitalize">{profile?.role || 'Estudiante'}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#21529B] flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {(profile?.full_name?.[0] || 'U').toUpperCase()}
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </section>
      </main>
    </div>
  );
};

export default Layout;
