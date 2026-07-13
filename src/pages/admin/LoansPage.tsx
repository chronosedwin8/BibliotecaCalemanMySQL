import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { RefreshCw, AlertCircle, Plus, X, Loader2, CheckCircle, Search, BookMarked, Clock, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, formatDistanceToNow, addDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { loansService, type LoanWithRelations } from '../../services/loans.service';
import { booksService, type BookWithRelations } from '../../services/books.service';
import { profilesService, type Profile } from '../../services/profiles.service';
import { reservasService, type ReservaWithRelations } from '../../services/reservas.service';

const LoansPage: React.FC = () => {
  const location = useLocation();
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [activeTab, setActiveTab] = useState<'loans' | 'reservas'>(() =>
    new URLSearchParams(location.search).get('tab') === 'reservas' ? 'reservas' : 'loans'
  );
  const [filter, setFilter] = useState<string>('');
  const queryClient = useQueryClient();

  // Sincronizar tab con cambios en la URL (ej: clic en el nav)
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'reservas') setActiveTab('reservas');
    else if (!tab) setActiveTab('loans');
  }, [location.search]);

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['loans', filter],
    queryFn: () => loansService.getAll(filter || undefined),
  });

  const returnMutation = useMutation({
    mutationFn: (loanId: string) => loansService.returnBook(loanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Devolución registrada');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleReturn = (loan: LoanWithRelations) => {
    const bookTitle = loan.books?.titulo ?? 'libro';
    if (window.confirm(`¿Registrar devolución de "${bookTitle}"?`)) {
      returnMutation.mutate(loan.id);
    }
  };

  const overdueLoans = loans.filter(
    (l) => l.estado !== 'returned' && isPast(new Date(l.fecha_devolucion_estimada))
  );
  const activeLoans = loans.filter((l) => l.estado !== 'returned');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Préstamos y Devoluciones</h2>
          <p className="text-gray-500">Registra entradas y salidas de ejemplares</p>
        </div>
        {activeTab === 'loans' && (
          <button
            onClick={() => setShowNewLoan(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Préstamo
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['loans', 'Préstamos', RefreshCw], ['reservas', 'Reservas', BookMarked]] as const).map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'reservas' && <ReservasAdminPanel />}

      {activeTab === 'loans' && (<>
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Activos</p>
              <p className="text-2xl font-bold">{activeLoans.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vencidos</p>
              <p className="text-2xl font-bold">{overdueLoans.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total registros</p>
              <p className="text-2xl font-bold">{loans.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { label: 'Todos', value: '' },
          { label: 'Activos', value: 'active' },
          { label: 'Vencidos', value: 'overdue' },
          { label: 'Devueltos', value: 'returned' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loans table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : loans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-12 h-12 mb-2" />
            <p>No hay préstamos</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-4 font-semibold text-sm">Libro</th>
                <th className="px-6 py-4 font-semibold text-sm">Usuario</th>
                <th className="px-6 py-4 font-semibold text-sm">Fecha préstamo</th>
                <th className="px-6 py-4 font-semibold text-sm">Devolución est.</th>
                <th className="px-6 py-4 font-semibold text-sm">Estado</th>
                <th className="px-6 py-4 font-semibold text-sm">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loans.map((loan) => {
                const isOverdue = loan.estado !== 'returned' && isPast(new Date(loan.fecha_devolucion_estimada));
                return (
                  <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800 dark:text-white">
                        {loan.books?.titulo ?? 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500">{loan.books?.autor}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{loan.profiles?.full_name ?? loan.usuario_id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">{loan.profiles?.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {format(new Date(loan.fecha_prestamo), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {format(new Date(loan.fecha_devolucion_estimada), 'dd/MM/yyyy')}
                      {loan.estado !== 'returned' && (
                        <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                          {isOverdue
                            ? `Vencido hace ${formatDistanceToNow(new Date(loan.fecha_devolucion_estimada), { locale: es })}`
                            : `En ${formatDistanceToNow(new Date(loan.fecha_devolucion_estimada), { locale: es })}`}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          loan.estado === 'returned'
                            ? 'bg-green-100 text-green-700'
                            : isOverdue
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {loan.estado === 'returned' ? 'Devuelto' : isOverdue ? 'Vencido' : 'Activo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {loan.estado !== 'returned' && (
                        <button
                          onClick={() => handleReturn(loan)}
                          disabled={returnMutation.isPending}
                          className="text-green-600 hover:underline text-sm font-medium flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Devolver
                        </button>
                      )}
                      {loan.fecha_devolucion_real && (
                        <span className="text-xs text-gray-500">
                          {format(new Date(loan.fecha_devolucion_real), 'dd/MM/yyyy')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showNewLoan && (
        <NewLoanModal onClose={() => setShowNewLoan(false)} />
      )}
      </>)}
    </div>
  );
};

const NewLoanModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [bookSearch, setBookSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedBook, setSelectedBook] = useState<BookWithRelations | null>(null);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [days, setDays] = useState(7);

  const { data: books = [] } = useQuery({
    queryKey: ['books-search', bookSearch],
    queryFn: () => booksService.getAll(bookSearch),
    enabled: bookSearch.length >= 2,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-search', userSearch],
    queryFn: () => profilesService.search(userSearch),
    enabled: userSearch.length >= 2,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedBook || !selectedUser) throw new Error('Selecciona libro y usuario');
      if (selectedBook.cantidad_disponible <= 0) throw new Error('No hay stock disponible');
      return loansService.create({
        libro_id: selectedBook.id,
        usuario_id: selectedUser.id,
        fecha_devolucion_estimada: addDays(new Date(), days).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Préstamo registrado');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold">Nuevo Préstamo</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Book search */}
          <div>
            <label className="block text-sm font-medium mb-1">Libro</label>
            {selectedBook ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div>
                  <p className="font-bold">{selectedBook.titulo}</p>
                  <p className="text-sm text-gray-500">{selectedBook.autor} - Disp: {selectedBook.cantidad_disponible}</p>
                </div>
                <button onClick={() => setSelectedBook(null)} className="text-red-500 hover:underline text-sm">
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por título, autor o barcode..."
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {books.length > 0 && bookSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {books.filter((b) => b.cantidad_disponible > 0).map((b) => (
                      <button
                        key={b.id}
                        onClick={() => { setSelectedBook(b); setBookSearch(''); }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <p className="font-medium text-sm">{b.titulo}</p>
                        <p className="text-xs text-gray-500">{b.autor}{b.codigo_barras ? ` · ${b.codigo_barras}` : ''} · Disp: {b.cantidad_disponible}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User search */}
          <div>
            <label className="block text-sm font-medium mb-1">Usuario</label>
            {selectedUser ? (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div>
                  <p className="font-bold">{selectedUser.full_name}</p>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-red-500 hover:underline text-sm">
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar usuario por nombre o email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {users.length > 0 && userSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setSelectedUser(u); setUserSearch(''); }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <p className="font-medium text-sm">{u.full_name ?? u.email}</p>
                        <p className="text-xs text-gray-500">{u.email} - {u.role}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Days */}
          <div>
            <label className="block text-sm font-medium mb-1">Días de préstamo</label>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value={7}>7 días (Estudiante)</option>
              <option value={14}>14 días (Profesor)</option>
              <option value={30}>30 días (Admin)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Devolución estimada: {format(addDays(new Date(), days), 'dd/MM/yyyy')}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!selectedBook || !selectedUser || mutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar Préstamo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Panel de Reservas para Admin ─────────────────────────────────────────────
const ReservasAdminPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pendiente');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmDays, setConfirmDays] = useState(7);

  const { data: reservas = [], isLoading } = useQuery<ReservaWithRelations[]>({
    queryKey: ['reservas-admin', filter],
    queryFn: () => reservasService.getAll(filter || undefined),
    refetchInterval: 60_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => reservasService.cancel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reservas-admin'] }); toast.success('Reserva cancelada'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, dias }: { id: string; dias: number }) => reservasService.confirm(id, dias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservas-admin'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Reserva confirmada — préstamo creado');
      setConfirmingId(null);
    },
    onError: (e: Error) => { toast.error(e.message); setConfirmingId(null); },
  });

  const ESTADO_OPTS = [
    { value: 'pendiente', label: 'Pendientes' },
    { value: 'completada', label: 'Completadas' },
    { value: 'cancelada', label: 'Canceladas' },
    { value: 'expirada', label: 'Expiradas' },
    { value: '', label: 'Todas' },
  ];

  return (
    <div className="space-y-4">
      {/* Filtro estado */}
      <div className="flex gap-2 flex-wrap">
        {ESTADO_OPTS.map(({ value, label }) => (
          <button key={value} onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : reservas.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <BookMarked className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No hay reservas con este filtro.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Libro</th>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Reservado</th>
                <th className="px-4 py-3 text-left">Expira</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reservas.map((r) => {
                const expiracion = new Date(r.fecha_expiracion);
                const vencido = expiracion < new Date();
                const ESTADO_COLOR: Record<string, string> = {
                  pendiente: 'bg-blue-100 text-blue-700',
                  completada: 'bg-green-100 text-green-700',
                  cancelada: 'bg-gray-100 text-gray-600',
                  expirada: 'bg-red-100 text-red-600',
                };
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 max-w-[200px] truncate">{r.books?.titulo}</p>
                      <p className="text-xs text-gray-500 truncate">{r.books?.autor}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.profiles?.full_name ?? r.usuario_id.slice(0,8)}</p>
                      <p className="text-xs text-gray-500">{r.profiles?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{format(new Date(r.fecha_reserva), 'dd/MM/yy HH:mm')}</td>
                    <td className="px-4 py-3">
                      <span className={vencido && r.estado === 'pendiente' ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                        {format(expiracion, 'dd/MM/yy HH:mm')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLOR[r.estado] ?? ''}`}>
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.estado === 'pendiente' && (
                        <div className="flex flex-col gap-1.5">
                          {confirmingId === r.id ? (
                            <div className="flex items-center gap-2">
                              <select value={confirmDays} onChange={(e) => setConfirmDays(parseInt(e.target.value))}
                                className="text-xs px-2 py-1 border border-gray-200 rounded-lg">
                                <option value={7}>7 días</option>
                                <option value={14}>14 días</option>
                                <option value={30}>30 días</option>
                              </select>
                              <button onClick={() => confirmMutation.mutate({ id: r.id, dias: confirmDays })}
                                disabled={confirmMutation.isPending}
                                className="text-xs px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                                {confirmMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                OK
                              </button>
                              <button onClick={() => setConfirmingId(null)} className="text-xs text-gray-500 hover:text-gray-700">×</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmingId(r.id)}
                              className="text-xs flex items-center gap-1 text-green-700 hover:text-green-800 font-medium">
                              <CheckCircle className="w-3.5 h-3.5" /> Confirmar préstamo
                            </button>
                          )}
                          <button onClick={() => { if (window.confirm('¿Cancelar reserva?')) cancelMutation.mutate(r.id); }}
                            disabled={cancelMutation.isPending}
                            className="text-xs flex items-center gap-1 text-red-600 hover:text-red-700 font-medium disabled:opacity-50">
                            <XCircle className="w-3.5 h-3.5" /> Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LoansPage;
