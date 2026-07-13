import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuthStore } from '../../hooks/useAuthStore';
import { loansService, type LoanWithRelations } from '../../services/loans.service';
import { multasService } from '../../services/multas.service';

const StudentDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  const { data: activeLoans = [], isLoading } = useQuery({
    queryKey: ['my-loans', user?.id],
    queryFn: () => loansService.getActiveByUser(user!.id),
    enabled: !!user,
  });

  const { data: pendingFines = 0 } = useQuery({
    queryKey: ['my-fines', user?.id],
    queryFn: () => multasService.getPendingByUser(user!.id),
    enabled: !!user,
  });

  const nextDue = activeLoans.length > 0
    ? activeLoans.reduce((closest, loan) => {
        const date = new Date(loan.fecha_devolucion_estimada);
        return date < closest ? date : closest;
      }, new Date(activeLoans[0].fecha_devolucion_estimada))
    : null;

  const stats = [
    {
      label: 'Préstamos Activos',
      value: activeLoans.length.toString(),
      icon: <BookOpen className="w-6 h-6" />,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Próx. Devolución',
      value: nextDue
        ? isPast(nextDue)
          ? 'Vencido'
          : formatDistanceToNow(nextDue, { locale: es })
        : '-',
      icon: <Clock className="w-6 h-6" />,
      color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Multas Pendientes',
      value: `$${pendingFines.toLocaleString()}`,
      icon: <AlertCircle className="w-6 h-6" />,
      color: 'text-red-600 bg-red-100 dark:bg-red-900/30',
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mi Panel</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <h3 className="text-lg font-bold mb-4">Mis Préstamos Activos</h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : activeLoans.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No tienes préstamos activos</p>
        ) : (
          <div className="space-y-3">
            {activeLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LoanCard: React.FC<{ loan: LoanWithRelations }> = ({ loan }) => {
  const dueDate = new Date(loan.fecha_devolucion_estimada);
  const isOverdue = isPast(dueDate);

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <p className="font-bold text-gray-800 dark:text-white">{loan.books?.titulo ?? 'N/A'}</p>
          <p className="text-sm text-gray-500">{loan.books?.autor}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
          {isOverdue
            ? `Vencido hace ${formatDistanceToNow(dueDate, { locale: es })}`
            : `Vence en ${formatDistanceToNow(dueDate, { locale: es })}`}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Renovaciones: {loan.renovaciones}/2
        </p>
      </div>
    </div>
  );
};

export default StudentDashboard;
