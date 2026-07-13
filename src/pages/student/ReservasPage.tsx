import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Clock, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { reservasService, type ReservaWithRelations } from '../../services/reservas.service';
import { useAuthStore } from '../../hooks/useAuthStore';

const ESTADO_CONFIG = {
  pendiente:  { label: 'Pendiente',  color: 'bg-blue-100 text-blue-700',   icon: Clock },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelada:  { label: 'Cancelada',  color: 'bg-gray-100 text-gray-600',   icon: XCircle },
  expirada:   { label: 'Expirada',   color: 'bg-red-100 text-red-600',     icon: XCircle },
};

function openLibraryCover(isbn: string | null | undefined): string | null {
  const c = isbn?.trim().replace(/[-\s]/g, '');
  return c ? `https://covers.openlibrary.org/b/isbn/${c}-M.jpg` : null;
}

const ReservaCard: React.FC<{ reserva: ReservaWithRelations; onCancel: (id: string) => void; canceling: boolean }> = ({
  reserva, onCancel, canceling,
}) => {
  const cfg = ESTADO_CONFIG[reserva.estado] ?? ESTADO_CONFIG.pendiente;
  const Icon = cfg.icon;
  const book = reserva.books;
  const imgSrc = book?.imagen_portada_url ?? openLibraryCover(book?.isbn);
  const expiracion = new Date(reserva.fecha_expiracion);
  const vencido = expiracion < new Date();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4">
      {/* Portada */}
      <div className="w-16 h-22 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200" style={{ height: '88px' }}>
        {imgSrc ? (
          <img src={imgSrc} alt={book?.titulo} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookMarked className="w-6 h-6 text-gray-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate">{book?.titulo ?? 'Libro no encontrado'}</p>
            <p className="text-sm text-gray-500 truncate">{book?.autor}</p>
          </div>
          <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
            <Icon className="w-3 h-3" /> {cfg.label}
          </span>
        </div>

        <div className="mt-2 space-y-1 text-xs text-gray-500">
          <p>Reservado: {format(new Date(reserva.fecha_reserva), 'dd/MM/yyyy HH:mm')}</p>
          {reserva.estado === 'pendiente' && (
            <p className={`font-medium ${vencido ? 'text-red-600' : 'text-amber-600'}`}>
              {vencido
                ? 'Expirada — el libro ya fue liberado'
                : `Expira ${formatDistanceToNow(expiracion, { addSuffix: true, locale: es })}`}
            </p>
          )}
        </div>

        {reserva.estado === 'pendiente' && !vencido && (
          <button
            onClick={() => onCancel(reserva.id)}
            disabled={canceling}
            className="mt-3 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
          >
            {canceling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Cancelar reserva
          </button>
        )}

        {reserva.estado === 'pendiente' && !vencido && (
          <div className="mt-2 flex items-start gap-1.5 bg-blue-50 rounded-lg px-2 py-1.5 text-xs text-blue-700">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Preséntate en la biblioteca con tu identificación para retirar el libro.
          </div>
        )}
      </div>
    </div>
  );
};

const ReservasPage: React.FC = () => {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [cancelingId, setCancelingId] = React.useState<string | null>(null);

  const { data: reservas = [], isLoading } = useQuery<ReservaWithRelations[]>({
    queryKey: ['reservas', profile?.id],
    queryFn: () => reservasService.getAll(),
    staleTime: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => reservasService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservas'] });
      queryClient.invalidateQueries({ queryKey: ['books-catalog'] });
      toast.success('Reserva cancelada');
      setCancelingId(null);
    },
    onError: (err: Error) => { toast.error(err.message); setCancelingId(null); },
  });

  const handleCancel = (id: string) => {
    if (!window.confirm('¿Cancelar esta reserva?')) return;
    setCancelingId(id);
    cancelMutation.mutate(id);
  };

  const pendientes = reservas.filter(r => r.estado === 'pendiente');
  const historial  = reservas.filter(r => r.estado !== 'pendiente');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mis Reservas</h2>
        <p className="text-sm text-gray-500 mt-1">
          Las reservas expiran automáticamente a las 24 horas si no se retiran.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Reservas activas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Pendientes ({pendientes.length})
            </h3>
            {pendientes.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <BookMarked className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No tienes reservas activas.</p>
                <p className="text-xs mt-1">Ve al catálogo y reserva un libro.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendientes.map(r => (
                  <ReservaCard key={r.id} reserva={r} onCancel={handleCancel} canceling={cancelingId === r.id} />
                ))}
              </div>
            )}
          </div>

          {/* Historial */}
          {historial.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Historial ({historial.length})
              </h3>
              <div className="space-y-3">
                {historial.map(r => (
                  <ReservaCard key={r.id} reserva={r} onCancel={handleCancel} canceling={cancelingId === r.id} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReservasPage;
