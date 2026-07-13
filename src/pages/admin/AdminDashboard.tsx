import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Book, RefreshCw, AlertTriangle, Loader2, Clock, BookMarked, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { booksService } from '../../services/books.service';
import { loansService, type LoanWithRelations } from '../../services/loans.service';
import { reservasService, type ReservaWithRelations } from '../../services/reservas.service';

const AdminDashboard: React.FC = () => {
  const { data: totalBooks = 0 } = useQuery({
    queryKey: ['stats-books-count'],
    queryFn: () => booksService.count(),
  });

  const { data: activeLoans = 0 } = useQuery({
    queryKey: ['stats-active-loans'],
    queryFn: () => loansService.countActive(),
  });

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ['stats-overdue'],
    queryFn: () => loansService.countOverdue(),
  });

  const { data: pendingReservas = [] } = useQuery<ReservaWithRelations[]>({
    queryKey: ['stats-reservas-pending'],
    queryFn: () => reservasService.getAll('pendiente'),
    refetchInterval: 60_000,
  });

  const { data: recentLoans = [], isLoading: loadingRecent } = useQuery({
    queryKey: ['recent-loans'],
    queryFn: () => loansService.getAll(),
    select: (data: LoanWithRelations[]) =>
      data.filter((l) => l.estado !== 'returned').slice(0, 5),
  });

  const stats = [
    {
      label: 'Total Libros',
      value: totalBooks.toLocaleString(),
      color: 'bg-[#21529B]',
      icon: <Book className="w-5 h-5" />,
    },
    {
      label: 'Préstamos Activos',
      value: activeLoans.toString(),
      color: 'bg-emerald-600',
      icon: <RefreshCw className="w-5 h-5" />,
    },
    {
      label: 'Reservas Pendientes',
      value: pendingReservas.length.toString(),
      color: 'bg-blue-500',
      icon: <BookMarked className="w-5 h-5" />,
      link: '/loans?tab=reservas',
    },
    {
      label: 'Préstamos Vencidos',
      value: overdueCount.toString(),
      color: 'bg-[#D4B420]',
      icon: <AlertTriangle className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard Administrativo</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => {
          const card = (
            <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 ${stat.link ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 ${stat.color} text-white rounded-xl`}>
                  {stat.icon}
                </div>
              </div>
              <div className={`h-1 w-12 ${stat.color} mt-4 rounded`} />
            </div>
          );
          return stat.link ? (
            <Link key={i} to={stat.link}>{card}</Link>
          ) : (
            <div key={i}>{card}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Préstamos activos recientes */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Préstamos Activos
            </h3>
            <Link to="/loans" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingRecent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : recentLoans.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-sm">No hay préstamos activos</p>
          ) : (
            <div className="space-y-2">
              {recentLoans.map((loan) => {
                const isOverdue = isPast(new Date(loan.fecha_devolucion_estimada));
                return (
                  <div
                    key={loan.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isOverdue
                        ? 'bg-red-50 border-red-100'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                        isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                          {loan.profiles?.full_name ?? 'Usuario'}
                        </p>
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {loan.books?.titulo ?? 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs flex-shrink-0 ml-2">
                      <p className={`font-bold ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {isOverdue ? 'VENCIDO' : `En ${formatDistanceToNow(new Date(loan.fecha_devolucion_estimada), { locale: es })}`}
                      </p>
                      <p className="text-gray-400">{format(new Date(loan.fecha_devolucion_estimada), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reservas pendientes */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-blue-500" />
              Reservas Pendientes
            </h3>
            <Link to="/loans?tab=reservas" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Gestionar <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pendingReservas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookMarked className="w-10 h-10 text-gray-200 mb-2" />
              <p className="text-gray-400 text-sm">No hay reservas pendientes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingReservas.slice(0, 5).map((reserva) => {
                const expiracion = new Date(reserva.fecha_expiracion);
                const proximaExpirar = expiracion.getTime() - Date.now() < 4 * 60 * 60 * 1000; // < 4h
                return (
                  <div
                    key={reserva.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      proximaExpirar ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                        proximaExpirar ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        <BookMarked className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                          {reserva.profiles?.full_name ?? 'Usuario'}
                        </p>
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {reserva.books?.titulo ?? 'Libro'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs flex-shrink-0 ml-2">
                      <p className={`font-bold ${proximaExpirar ? 'text-amber-600' : 'text-blue-600'}`}>
                        {proximaExpirar ? '⚠ Por vencer' : 'Pendiente'}
                      </p>
                      <p className="text-gray-400">
                        Expira {formatDistanceToNow(expiracion, { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {pendingReservas.length > 5 && (
                <Link to="/loans?tab=reservas" className="block text-center text-xs text-blue-600 hover:underline pt-1">
                  Ver {pendingReservas.length - 5} más →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
