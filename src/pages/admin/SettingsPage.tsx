import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Loader2, GraduationCap, BookOpen, Hash, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { catalogValuesService, type CatalogType } from '../../services/catalogValues.service';

// ── Config for each catalog section ──────────────────────────────────────────
const CATALOG_SECTIONS: Array<{
  type: CatalogType;
  label: string;
  description: string;
  icon: React.ReactNode;
  placeholder: string;
  color: string;
}> = [
  {
    type: 'niveles',
    label: 'Niveles',
    description: 'Niveles de formación del colegio (ej. KINDERGARTEN, GRUNDSCHULE, BACHILLERATO).',
    icon: <GraduationCap className="w-5 h-5" />,
    placeholder: 'Ej: GRUNDSCHULE',
    color: 'blue',
  },
  {
    type: 'cursos',
    label: 'Cursos',
    description: 'Cursos o grados disponibles (ej. KINDERKRIPPE, KINDER, KLASSE 1).',
    icon: <BookOpen className="w-5 h-5" />,
    placeholder: 'Ej: KLASSE 9',
    color: 'emerald',
  },
  {
    type: 'secciones',
    label: 'Secciones',
    description: 'Secciones o grupos dentro de cada curso (ej. K1A, K2B, KKP1).',
    icon: <Hash className="w-5 h-5" />,
    placeholder: 'Ej: K9A',
    color: 'purple',
  },
];

const COLOR_MAP: Record<string, Record<string, string>> = {
  blue:    { header: 'bg-blue-50 border-blue-200',    badge: 'bg-blue-100 text-blue-800',    btn: 'bg-blue-600 hover:bg-blue-700',    icon: 'text-blue-600',    ring: 'focus:ring-blue-500' },
  emerald: { header: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', btn: 'bg-emerald-600 hover:bg-emerald-700', icon: 'text-emerald-600', ring: 'focus:ring-emerald-500' },
  purple:  { header: 'bg-purple-50 border-purple-200',  badge: 'bg-purple-100 text-purple-800',  btn: 'bg-purple-600 hover:bg-purple-700',  icon: 'text-purple-600',  ring: 'focus:ring-purple-500' },
};

// ── Single catalog panel ──────────────────────────────────────────────────────
interface CatalogPanelProps {
  type: CatalogType;
  label: string;
  description: string;
  icon: React.ReactNode;
  placeholder: string;
  color: string;
}

const CatalogPanel: React.FC<CatalogPanelProps> = ({
  type, label, description, icon, placeholder, color,
}) => {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const c = COLOR_MAP[color];

  const { data: values = [], isLoading } = useQuery({
    queryKey: ['catalog-values', type],
    queryFn: () => catalogValuesService.get(type),
    staleTime: 0,
  });

  const addMutation = useMutation({
    mutationFn: (v: string) => catalogValuesService.add(type, v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-values'] });
      setInput('');
      inputRef.current?.focus();
      toast.success('Valor agregado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (v: string) => catalogValuesService.remove(type, v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-values'] });
      toast.success('Valor eliminado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAdd = () => {
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      toast.error('Este valor ya existe');
      return;
    }
    addMutation.mutate(trimmed);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`flex items-start gap-3 px-5 py-4 border-b ${c.header}`}>
        <span className={c.icon}>{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800">{label}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <span className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full flex-shrink-0">
          {isLoading ? '…' : values.length}
        </span>
      </div>

      {/* Values chips */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : values.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Sin valores aún. Agrega el primero abajo.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {values.map((v) => (
              <span
                key={v}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${c.badge}`}
              >
                {v}
                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar "${v}"?`)) removeMutation.mutate(v);
                  }}
                  disabled={removeMutation.isPending}
                  className="hover:opacity-70 transition-opacity ml-0.5"
                  title="Eliminar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add input */}
        <div className="flex gap-2 mt-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder={placeholder}
            className={`flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${c.ring} dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim() || addMutation.isPending}
            className={`flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${c.btn}`}
          >
            {addMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main SettingsPage ─────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 rounded-xl">
          <Settings className="w-6 h-6 text-gray-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
          <p className="text-sm text-gray-500">
            Gestiona los valores disponibles en los formularios del sistema
          </p>
        </div>
      </div>

      {/* Catalog values section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-4 h-4 text-gray-500" />
          <h3 className="text-base font-semibold text-gray-700">Listas de valores — Formulario de Usuarios</h3>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Estos son los valores que aparecen en los combos de <strong>Nivel</strong>, <strong>Curso</strong> y{' '}
          <strong>Sección</strong> al crear o editar usuarios. Al agregar un valor nuevo, quedará disponible
          inmediatamente en el formulario. Los valores se ordenan automáticamente.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {CATALOG_SECTIONS.map((s) => (
            <CatalogPanel key={s.type} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
