import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../hooks/useAuthStore';
import { api, API_BASE } from '../../services/api';
import logoUrl from '../../../logo.avif';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const [params] = useSearchParams();
  const [ssoDisponible, setSsoDisponible] = useState(false);

  // El backend dice si el SSO está configurado; si no, no se muestra el botón.
  useEffect(() => {
    api.get<{ microsoft: boolean }>('/auth/sso/status')
      .then((r) => setSsoDisponible(r.microsoft))
      .catch(() => setSsoDisponible(false));
  }, []);

  // Si el rodeo por Microsoft falló, el backend devuelve el motivo en la URL.
  useEffect(() => {
    const err = params.get('sso_error');
    if (err) toast.error(err, { duration: 6000 });
  }, [params]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('¡Bienvenido de nuevo!');
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-gray-900 relative">
      {/* Panel lateral de marca */}
      <div className="hidden lg:flex lg:w-2/5 bg-[#21529B] flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Línea gráfica institucional */}
        <div className="absolute inset-0 brand-pattern opacity-[0.13]" aria-hidden="true" />
        <div className="relative z-10 text-center">
          <div className="mx-auto w-28 h-28 bg-white rounded-2xl shadow-2xl flex items-center justify-center mb-8">
            <img src={logoUrl} alt="Logo" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2">BiblioCalem</h1>
          <p className="text-blue-200 text-sm uppercase tracking-widest mb-8">Biblioteca Escolar</p>
          <div className="w-12 h-1 bg-[#F0CE2D] mx-auto rounded-full mb-8" />
          <p className="text-blue-100 text-sm italic max-w-xs leading-relaxed">
            "La lectura es para la mente lo que el ejercicio para el cuerpo."
          </p>
        </div>
      </div>

      {/* Formulario de ingreso */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Franja tricolor institucional */}
        <div className="absolute top-0 inset-x-0 brand-rule" aria-hidden="true" />
        <div className="w-full max-w-sm">
          {/* Logo móvil */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white rounded-xl shadow flex items-center justify-center">
              <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">BiblioCalem</h1>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Biblioteca Escolar</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bienvenido</h2>
            <p className="mt-1 text-sm text-gray-500">Ingresa tus credenciales para continuar</p>
          </div>

          {ssoDisponible && (
            <div className="mb-6">
              <a
                href={`${API_BASE}/auth/microsoft`}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 23 23" aria-hidden="true">
                  <path fill="#F25022" d="M0 0h11v11H0z" />
                  <path fill="#7FBA00" d="M12 0h11v11H12z" />
                  <path fill="#00A4EF" d="M0 12h11v11H0z" />
                  <path fill="#FFB900" d="M12 12h11v11H12z" />
                </svg>
                Continuar con tu cuenta institucional
              </a>
              <div className="flex items-center gap-3 mt-6">
                <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400 uppercase tracking-wide">o con contraseña</span>
                <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21529B] focus:border-transparent transition-all text-sm"
                    placeholder="usuario@colegioaleman.edu.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21529B] focus:border-transparent transition-all text-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center text-sm">
              <label className="flex items-center text-gray-500 cursor-pointer gap-2">
                <input type="checkbox" className="rounded border-gray-300 text-[#21529B] focus:ring-[#21529B]" />
                Recordarme
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold text-white bg-[#21529B] hover:bg-[#1A4280] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#21529B] transition-all disabled:opacity-60 shadow-md shadow-blue-200 dark:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
