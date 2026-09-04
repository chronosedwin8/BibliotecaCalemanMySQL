import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';

/**
 * Aterrizaje tras el rodeo por Microsoft.
 *
 * El backend no manda el JWT en la URL: manda un ticket de un solo uso que
 * aquí se canjea por POST. Así el token no queda en el historial del navegador
 * ni en los logs del proxy.
 */
const SsoCallback: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const completeSso = useAuthStore((s) => s.completeSso);
  const [error, setError] = useState<string | null>(null);
  const yaCanjeado = useRef(false);

  useEffect(() => {
    // StrictMode ejecuta el efecto dos veces en desarrollo y el ticket sólo
    // sirve una vez: sin esta guarda el segundo intento fallaría.
    if (yaCanjeado.current) return;
    yaCanjeado.current = true;

    const ticket = params.get('ticket');
    if (!ticket) {
      setError('No se recibió el ticket de acceso.');
      return;
    }

    completeSso(ticket)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudo completar el ingreso.'));
  }, [params, completeSso, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-gray-900 p-6">
      {error ? (
        <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-[#C03928] mx-auto mb-3" />
          <h1 className="font-bold text-gray-900 dark:text-white mb-1">No se pudo iniciar sesión</h1>
          <p className="text-sm text-gray-500 mb-5">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full bg-[#21529B] text-white py-2.5 rounded-lg text-sm font-bold hover:bg-[#1A4280] transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      ) : (
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#21529B] mx-auto mb-3" />
          <p className="text-sm text-gray-500">Validando tu cuenta institucional…</p>
        </div>
      )}
    </div>
  );
};

export default SsoCallback;
