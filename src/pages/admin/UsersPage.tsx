import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Users, Loader2, Pencil, X, Upload,
  UserCheck, UserX, Filter, ChevronDown, ChevronUp,
  FileSpreadsheet, AlertTriangle, CheckCircle2, RefreshCw, Camera,
  Download, Table2, GraduationCap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import {
  usersService,
  type UserProfile,
  type CreateUserData,
  type UsersFilter,
  type BulkImportUserResult,
  type PhidiasSyncResult,
} from '../../services/users.service';
import { catalogValuesService } from '../../services/catalogValues.service';

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = 'usuarios' | 'importar';

interface UserFormValues {
  full_name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  codigo_identificacion: string;
  telefono: string;
  section: string;
  course: string;
  level: string;
  password: string;
}

interface ExcelPreviewRow {
  codigo: string;
  full_name: string;
  email: string;
  role: string;
  telefono: string;
  course: string;
  section: string;
  level: string;
  password: string;
  valid: boolean;
  error?: string;
}

// ─── Avatar Component ─────────────────────────────────────────────────────────
interface AvatarProps {
  user: UserProfile;
  size?: 'sm' | 'md' | 'lg';
}

const UserAvatar: React.FC<AvatarProps> = ({ user, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);

  const initials = (user.full_name ?? user.email ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

  const roleColor =
    user.role === 'admin'
      ? 'bg-purple-200 text-purple-700'
      : user.role === 'teacher'
      ? 'bg-blue-200 text-blue-700'
      : 'bg-emerald-100 text-emerald-700';

  const sizeClass =
    size === 'sm' ? 'w-8 h-8 text-xs' :
    size === 'lg' ? 'w-20 h-20 text-xl' :
    'w-11 h-11 text-sm';

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white shadow-sm`}>
      {user.avatar_url && !imgError ? (
        <img
          src={user.avatar_url}
          alt={user.full_name ?? ''}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center font-semibold ${roleColor}`}>
          {initials}
        </div>
      )}
    </div>
  );
};

// ─── Helper ──────────────────────────────────────────────────────────────────
function roleLabel(role: string) {
  return role === 'admin' ? 'Administrador' : role === 'teacher' ? 'Docente' : 'Estudiante';
}

function roleBadge(role: string) {
  const base = 'text-xs px-2 py-0.5 rounded-full font-medium';
  if (role === 'admin') return `${base} bg-purple-100 text-purple-700`;
  if (role === 'teacher') return `${base} bg-blue-100 text-blue-700`;
  return `${base} bg-green-100 text-green-700`;
}

function estadoBadge(estado: string) {
  const base = 'text-xs px-2 py-0.5 rounded-full font-medium';
  return estado === 'activo'
    ? `${base} bg-emerald-100 text-emerald-700`
    : `${base} bg-red-100 text-red-700`;
}

// ─── Excel User Import helpers ────────────────────────────────────────────────
const USER_COL_DEFS = [
  { field: 'codigo',    label: 'Código',          aliases: ['code','codigo','código','cod','id','carnet'],                              example: 'EST-001',               notes: '** Requerido **' },
  { field: 'full_name', label: 'Nombre Completo',  aliases: ['name','nombre','full_name','nombre completo','fullname'],                  example: 'García López, Ana',     notes: '** Requerido **' },
  { field: 'email',     label: 'Email',            aliases: ['email','correo','mail','correo electronico','correo electrónico'],         example: 'ana@colegio.edu.co',    notes: 'Si se omite, se genera del código' },
  { field: 'role',      label: 'Rol',              aliases: ['role','rol','tipo','perfil'],                                             example: 'student',               notes: 'student / teacher / admin (default: student)' },
  { field: 'telefono',  label: 'Teléfono',         aliases: ['telefono','teléfono','tel','phone','celular'],                            example: '3001234567',            notes: '' },
  { field: 'level',     label: 'Nivel',            aliases: ['level','nivel','grado','grade'],                                         example: 'Primaria',              notes: '' },
  { field: 'course',    label: 'Curso',            aliases: ['course','curso','clase','class'],                                        example: '5°',                    notes: '' },
  { field: 'section',   label: 'Sección',          aliases: ['section','seccion','sección','grupo','group','paralelo'],                 example: 'A',                     notes: '' },
  { field: 'password',  label: 'Contraseña',       aliases: ['password','contraseña','contrasena','clave','pass'],                     example: 'Colegio123',            notes: 'Si se omite, usa Colegio123' },
] as const;

type UserFieldName = typeof USER_COL_DEFS[number]['field'];

function normalizeUserHeader(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function buildUserFieldMap(headers: string[]): Map<number, UserFieldName> {
  const map = new Map<number, UserFieldName>();
  headers.forEach((h, idx) => {
    const norm = normalizeUserHeader(h);
    for (const def of USER_COL_DEFS) {
      if (def.aliases.some((a) => normalizeUserHeader(a) === norm)) {
        if (!map.has(idx)) map.set(idx, def.field);
        break;
      }
    }
  });
  return map;
}

function parseUserExcel(file: File): Promise<ExcelPreviewRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
        if (allRows.length < 2) { resolve([]); return; }

        const headerRow = (allRows[0] as unknown[]).map((h) => String(h ?? ''));
        const fieldMap = buildUserFieldMap(headerRow);
        const get = (row: unknown[], field: UserFieldName): string => {
          for (const [idx, f] of fieldMap) { if (f === field) return String(row[idx] ?? '').trim(); }
          return '';
        };

        const rows: ExcelPreviewRow[] = [];
        for (let i = 1; i < allRows.length; i++) {
          const row = allRows[i] as unknown[];
          if (row.every((c) => c == null || c === '')) continue;

          const codigo = get(row, 'codigo');
          const rawName = get(row, 'full_name');
          let email = get(row, 'email');
          if (!email && codigo) email = `${codigo}@colegioaleman.edu.co`;
          const rawRole = get(row, 'role').toLowerCase();
          const role = ['admin','teacher','student'].includes(rawRole) ? rawRole : 'student';

          let error: string | undefined;
          if (!codigo) error = 'Código vacío';
          else if (!rawName) error = 'Nombre vacío';
          else if (!email) error = 'Sin email y sin código para generar uno';

          rows.push({
            codigo,
            full_name: rawName,
            email,
            role,
            telefono: get(row, 'telefono'),
            level: get(row, 'level'),
            course: get(row, 'course'),
            section: get(row, 'section'),
            password: get(row, 'password'),
            valid: !error,
            error,
          });
        }
        resolve(rows);
      } catch {
        reject(new Error('No se pudo leer el archivo Excel'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

function downloadUserTemplate() {
  const headers = USER_COL_DEFS.map((d) => d.label);
  const example = USER_COL_DEFS.map((d) => d.example);
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = USER_COL_DEFS.map((d) => ({ wch: Math.max(d.label.length + 2, d.example.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
  XLSX.writeFile(wb, 'plantilla_usuarios_bibliocalem.xlsx');
}

// ─── User Form Modal ──────────────────────────────────────────────────────────
interface UserFormModalProps {
  user: UserProfile | null;
  onClose: () => void;
  onSaved: () => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ user, onClose, onSaved }) => {
  const isEdit = !!user;
  const queryClient = useQueryClient();
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen debe pesar menos de 5 MB'); return; }
    setAvatarUploading(true);
    try {
      const url = await usersService.uploadAvatar(user.id, file);
      setAvatarUrl(url);
      setAvatarImgError(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Foto actualizada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir foto');
    } finally {
      setAvatarUploading(false);
      if (avatarFileRef.current) avatarFileRef.current.value = '';
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    defaultValues: {
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'student',
      codigo_identificacion: user?.codigo_identificacion ?? '',
      telefono: user?.telefono ?? '',
      section: user?.section ?? '',
      course: user?.course ?? '',
      level: user?.level ?? '',
      password: '',
    },
  });

  const role = watch('role');

  // Catalog values for dropdowns
  const { data: catalogValues } = useQuery({
    queryKey: ['catalog-values'],
    queryFn: () => catalogValuesService.getAll(),
    staleTime: 5 * 60 * 1000,
  });
  const niveles = catalogValues?.niveles ?? [];
  const cursos = catalogValues?.cursos ?? [];
  const secciones = catalogValues?.secciones ?? [];

  const onSubmit = async (values: UserFormValues) => {
    try {
      if (isEdit) {
        await usersService.update(user.id, {
          full_name: values.full_name || null,
          role: values.role,
          codigo_identificacion: values.codigo_identificacion || null,
          telefono: values.telefono || null,
          section: values.section || null,
          course: values.course || null,
          level: values.level || null,
        });
        toast.success('Usuario actualizado');
      } else {
        const data: CreateUserData = {
          email: values.email,
          full_name: values.full_name,
          role: values.role,
          codigo_identificacion: values.codigo_identificacion,
          telefono: values.telefono,
          section: values.section,
          course: values.course,
          level: values.level,
          password: values.password || undefined,
        };
        await usersService.create(data);
        toast.success('Usuario creado — contraseña: Colegio123');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h3 className="text-lg font-bold">{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Avatar upload — solo al editar */}
          {isEdit && (
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-gray-100 dark:ring-gray-700 shadow flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                  {avatarUrl && !avatarImgError ? (
                    <img
                      src={avatarUrl}
                      alt={user?.full_name ?? ''}
                      className="w-full h-full object-cover"
                      onError={() => setAvatarImgError(true)}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-xl font-bold ${
                      user?.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                      user?.role === 'teacher' ? 'bg-blue-100 text-blue-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                      {(user?.full_name ?? user?.email ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                    </div>
                  )}
                  {avatarUploading && (
                    <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  title="Cambiar foto"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">{user?.full_name ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  disabled={avatarUploading}
                  className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <Upload className="w-3 h-3" />
                  {avatarUrl && !avatarImgError ? 'Cambiar foto' : 'Subir foto'}
                </button>
                <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP · máx. 5 MB</p>
              </div>
            </div>
          )}

          {/* Nombre completo */}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre completo *</label>
            <input
              {...register('full_name', { required: 'Requerido' })}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              readOnly={isEdit}
              {...register('email', { required: 'Requerido' })}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 read-only:bg-gray-50 dark:read-only:bg-gray-900"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          {/* Rol */}
          <div>
            <label className="block text-sm font-medium mb-1">Rol *</label>
            <select
              {...register('role', { required: true })}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="student">Estudiante</option>
              <option value="teacher">Docente</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {/* Código / Cédula */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {role === 'student' ? 'Código de estudiante' : 'Cédula de ciudadanía'} *
            </label>
            <input
              {...register('codigo_identificacion', { required: 'Requerido' })}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.codigo_identificacion && (
              <p className="text-red-500 text-xs mt-1">{errors.codigo_identificacion.message}</p>
            )}
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono</label>
            <input
              {...register('telefono')}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Level / Course / Section — solo para estudiantes */}
          {role === 'student' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nivel</label>
                <select
                  {...register('level')}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Seleccionar —</option>
                  {niveles.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Curso</label>
                <select
                  {...register('course')}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Seleccionar —</option>
                  {cursos.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sección</label>
                <select
                  {...register('section')}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Seleccionar —</option>
                  {secciones.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Contraseña — solo al crear */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Contraseña <span className="text-gray-400 font-normal">(deja vacío para usar Colegio123)</span>
              </label>
              <input
                type="password"
                {...register('password')}
                placeholder="Colegio123"
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Excel Import Panel ───────────────────────────────────────────────────────
interface ExcelImportPanelProps {
  onImportDone: () => void;
}

const ExcelUserImportPanel: React.FC<ExcelImportPanelProps> = ({ onImportDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ExcelPreviewRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BulkImportUserResult | null>(null);
  const [showCols, setShowCols] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setResult(null);
    try {
      const rows = await parseUserExcel(file);
      setPreview(rows);
      if (rows.length === 0) toast.error('El archivo está vacío o no tiene filas de datos');
      else toast.success(`Archivo leído: ${rows.filter((r) => r.valid).length} filas válidas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al leer el archivo');
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) handleFile(file);
    else toast.error('Solo se aceptan archivos .xlsx o .xls');
  };

  const validRows = preview.filter((r) => r.valid);
  const invalidRows = preview.filter((r) => !r.valid);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setProgress(0);

    const toImport: CreateUserData[] = validRows.map((r) => ({
      email: r.email,
      full_name: r.full_name,
      role: r.role as CreateUserData['role'],
      codigo_identificacion: r.codigo,
      telefono: r.telefono || undefined,
      section: r.section || undefined,
      course: r.course || undefined,
      level: r.level || undefined,
      password: r.password || undefined,
    }));

    try {
      const res = await usersService.bulkImport(toImport, (done, total) => {
        setProgress(Math.round((done / total) * 100));
      });
      setResult(res);
      if (res.created + res.updated > 0) {
        toast.success(`${res.created} creados, ${res.updated} actualizados`);
        onImportDone();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setPreview([]);
    setFileName('');
    setResult(null);
    setProgress(0);
  };

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Las columnas se detectan por nombre. El archivo puede tenerlas en cualquier orden.</p>
        </div>
        <button
          onClick={downloadUserTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          Descargar plantilla
        </button>
      </div>

      {/* Column reference accordion */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowCols(!showCols)}
          className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <Table2 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Columnas reconocidas ({USER_COL_DEFS.length})</span>
          <span className="ml-auto text-xs text-gray-400">{showCols ? '▲ Ocultar' : '▼ Ver'}</span>
        </button>
        {showCols && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 w-40">Nombre en cabecera</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Ejemplo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {USER_COL_DEFS.map((d) => (
                  <tr key={d.field} className={d.field === 'codigo' || d.field === 'full_name' ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {d.label}
                      {(d.field === 'codigo' || d.field === 'full_name') && <span className="ml-1 text-blue-600 font-bold">*</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 font-mono">{d.example}</td>
                    <td className="px-3 py-2 text-gray-400">{d.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-blue-700 bg-blue-50 border-t border-blue-100">
              <span className="font-bold text-blue-600">*</span> Campos requeridos. Columnas detectadas sin distinción de mayúsculas ni tildes.
            </p>
          </div>
        )}
      </div>

      {/* Drop zone */}
      {!preview.length && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-colors"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
            <FileSpreadsheet className="w-7 h-7 text-blue-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-700">Arrastra el archivo Excel aquí</p>
            <p className="text-sm text-gray-500 mt-1">o haz clic para seleccionarlo (.xlsx, .xls)</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInputChange} />
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="space-y-3">
          {/* File info */}
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3">
            <FileSpreadsheet className="w-7 h-7 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{fileName}</p>
              <p className="text-xs text-gray-500">{preview.length} filas · {validRows.length} válidas · {invalidRows.length} con error</p>
            </div>
            <button onClick={reset} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Validation summary */}
          {invalidRows.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{invalidRows.length} filas con error serán omitidas. Verifica que Código y Nombre estén completos.</span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-100 max-h-72">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {['#','Código','Nombre','Email','Rol','Nivel','Curso','Sección','Estado'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 200).map((row, i) => (
                  <tr key={i} className={`border-t ${!row.valid ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono">{row.codigo || '—'}</td>
                    <td className="px-3 py-1.5 truncate max-w-[140px]">{row.full_name || '—'}</td>
                    <td className="px-3 py-1.5 truncate max-w-[140px]">{row.email || '—'}</td>
                    <td className="px-3 py-1.5">{row.role || 'student'}</td>
                    <td className="px-3 py-1.5">{row.level || '—'}</td>
                    <td className="px-3 py-1.5">{row.course || '—'}</td>
                    <td className="px-3 py-1.5">{row.section || '—'}</td>
                    <td className="px-3 py-1.5">
                      {row.valid
                        ? <span className="text-emerald-600 font-medium">✓</span>
                        : <span className="text-red-500" title={row.error}>✗ {row.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          {!result && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Cambiar archivo
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? `Importando… ${progress}%` : `Importar ${validRows.length} usuarios`}
              </button>
              {importing && (
                <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[120px]">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="font-semibold text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Importación completada
              </p>
              <ul className="text-sm text-green-700 space-y-1">
                <li>✓ {result.created} usuarios creados</li>
                <li>↻ {result.updated} usuarios actualizados</li>
                {result.errors.length > 0 && <li className="text-red-600">✗ {result.errors.length} errores</li>}
              </ul>
              {result.errors.length > 0 && (
                <details className="text-xs text-red-600 mt-2">
                  <summary className="cursor-pointer font-medium">Ver errores</summary>
                  <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>Fila {e.row} ({e.codigo}): {e.message}</li>)}
                  </ul>
                </details>
              )}
              <button onClick={reset} className="text-sm text-blue-600 hover:underline mt-1">
                Importar otro archivo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
// ─── Sincronización con Phidias ──────────────────────────────────────────────

const PhidiasSyncModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [preview, setPreview] = useState<PhidiasSyncResult | null>(null);
  const [result,  setResult]  = useState<PhidiasSyncResult | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    usersService.phidiasPreview()
      .then(setPreview)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error consultando Phidias'))
      .finally(() => setCargando(false));
  }, []);

  const aplicar = async () => {
    setAplicando(true);
    try {
      const r = await usersService.phidiasSync();
      setResult(r);
      toast.success(`${r.creados} creados · ${r.actualizados} actualizados · ${r.desactivados} desactivados`);
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error sincronizando');
    } finally {
      setAplicando(false);
    }
  };

  const datos = result ?? preview;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            Sincronizar con Phidias
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {cargando && (
            <div className="flex items-center gap-3 text-sm text-gray-500 py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              Consultando estudiantes matriculados…
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {datos && (
            <>
              <p className="text-sm text-gray-500">
                {result
                  ? 'Sincronización aplicada.'
                  : `Phidias reporta ${datos.matriculasActivas} matrículas activas. Esto es lo que se hará:`}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Se crearán',      datos.creados,       'text-green-700 bg-green-50 border-green-200'],
                  ['Se actualizarán', datos.actualizados,  'text-blue-700 bg-blue-50 border-blue-200'],
                  ['Sin cambios',     datos.sinCambios,    'text-gray-600 bg-gray-50 border-gray-200'],
                  ['Se desactivarán', datos.desactivados,  'text-amber-800 bg-amber-50 border-amber-200'],
                ] as const).map(([label, n, cls]) => (
                  <div key={label} className={`border rounded-lg px-3 py-2 ${cls}`}>
                    <p className="text-2xl font-bold leading-tight">{n}</p>
                    <p className="text-xs font-medium">{result ? label.replace('Se ', '').replace('án', 'ados') : label}</p>
                  </div>
                ))}
              </div>

              {datos.desactivados > 0 && !result && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {datos.desactivados} estudiantes de la base ya no aparecen matriculados en Phidias.
                    Pasarán a <strong>inactivo</strong>: no podrán iniciar sesión, pero se conserva todo
                    su historial de préstamos y multas. Es reversible.
                  </span>
                </div>
              )}

              {datos.omitidos.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                    {datos.omitidos.length} omitidos (ver detalle)
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto text-gray-600">
                    {datos.omitidos.map((o, i) => (
                      <li key={i}>
                        <span className="font-medium">{o.nombre || o.codigo || '—'}</span> · {o.motivo}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {datos.errores.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                  {datos.errores.length} con error. Primero: {datos.errores[0].motivo}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
            {result ? 'Cerrar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              onClick={aplicar}
              disabled={!preview || aplicando || !!error}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {aplicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {aplicando ? 'Sincronizando…' : 'Aplicar sincronización'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const UsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios');
  const [showPhidias, setShowPhidias] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<UsersFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const queryClient = useQueryClient();
  const searchRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const queryFilters: UsersFilter = { ...filters, search: debouncedSearch || undefined };

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['users', queryFilters],
    queryFn: () => usersService.getAll(queryFilters),
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['users-courses'],
    queryFn: () => usersService.getDistinctCourses(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: 'activo' | 'inactivo' }) =>
      usersService.toggleEstado(id, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Estado actualizado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleToggle = (user: UserProfile) => {
    const nuevo = user.estado === 'activo' ? 'inactivo' : 'activo';
    const msg =
      nuevo === 'inactivo'
        ? `¿Inhabilitar a ${user.full_name}?`
        : `¿Habilitar a ${user.full_name}?`;
    if (window.confirm(msg)) toggleMutation.mutate({ id: user.id, estado: nuevo });
  };

  const openCreate = () => { setEditingUser(null); setShowModal(true); };
  const openEdit = (u: UserProfile) => { setEditingUser(u); setShowModal(true); };
  const onSaved = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setDebouncedSearch('');
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(Boolean) || debouncedSearch;

  const exportUsers = async () => {
    const toastId = toast.loading('Obteniendo todos los usuarios…');
    try {
      const data = await usersService.getAllForExport();
      toast.dismiss(toastId);
      if (data.length === 0) { toast.error('No hay usuarios para exportar'); return; }
    const ROLE_ES: Record<string, string> = { admin: 'Administrador', teacher: 'Docente', student: 'Estudiante' };
    const rows = data.map((u) => ({
      'Código':        u.codigo_identificacion ?? '',
      'Nombre Completo': u.full_name ?? '',
      'Email':         u.email,
      'Rol':           ROLE_ES[u.role] ?? u.role,
      'Teléfono':      u.telefono ?? '',
      'Nivel':         u.level ?? '',
      'Curso':         u.course ?? '',
      'Sección':       u.section ?? '',
      'Estado':        u.estado,
      'Fecha creación': u.created_at ? u.created_at.slice(0, 10) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.writeFile(wb, `usuarios_bibliocalem_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${data.length} usuarios exportados`);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message ?? 'Error al exportar');
    }
  };

  const totalPages = Math.ceil(allUsers.length / PAGE_SIZE);
  const users = allUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
          <p className="text-gray-500 text-sm">Administra estudiantes, docentes y administradores</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPhidias(true)}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            title="Actualizar estudiantes desde Phidias (Estudiantes Matriculados)"
          >
            <GraduationCap className="w-4 h-4 text-blue-600" />
            Sincronizar Phidias
          </button>
          <button
            onClick={exportUsers}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4 text-purple-600" />
            Exportar Excel
          </button>
          <button
            onClick={() => setActiveTab('importar')}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            Importar Excel
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {([['usuarios', 'Usuarios', Users], ['importar', 'Importar Excel', FileSpreadsheet]] as const).map(
          ([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'usuarios' && allUsers.length > 0 && (
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-1.5 py-0.5 rounded-full">
                  {allUsers.length}
                </span>
              )}
            </button>
          )
        )}
      </div>

      {/* ── TAB: Usuarios ── */}
      {activeTab === 'usuarios' && (
        <>
          {/* Search + Filters */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, apellido, código, email, curso…"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  showFilters || Object.values(filters).some(Boolean)
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtros
                {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {hasFilters && (
                <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
                  Limpiar
                </button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Rol</label>
                  <select
                    value={filters.role ?? ''}
                    onChange={(e) => setFilters((f) => ({ ...f, role: (e.target.value as UsersFilter['role']) || undefined }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">Todos</option>
                    <option value="student">Estudiante</option>
                    <option value="teacher">Docente</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Curso</label>
                  <select
                    value={filters.course ?? ''}
                    onChange={(e) => setFilters((f) => ({ ...f, course: e.target.value || undefined }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">Todos</option>
                    {courses.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Estado</label>
                  <select
                    value={filters.estado ?? ''}
                    onChange={(e) => setFilters((f) => ({ ...f, estado: (e.target.value as UsersFilter['estado']) || undefined }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">Todos</option>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No se encontraron usuarios</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Código / Cédula</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Nombre</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Email</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Rol</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Curso / Sección</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Estado</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-400 text-sm">
                          {u.codigo_identificacion ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={u} size="sm" />
                            <span className="font-medium truncate max-w-[180px]">{u.full_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={roleBadge(u.role)}>{roleLabel(u.role)}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {u.course ? (
                            <span>
                              {u.course}
                              {u.section && <span className="text-gray-400"> · {u.section}</span>}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={estadoBadge(u.estado)}>{u.estado}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 hover:text-gray-700"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggle(u)}
                              disabled={toggleMutation.isPending}
                              className={`p-1.5 rounded transition-colors ${
                                u.estado === 'activo'
                                  ? 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                                  : 'hover:bg-green-50 text-gray-400 hover:text-green-600'
                              }`}
                              title={u.estado === 'activo' ? 'Inhabilitar' : 'Habilitar'}
                            >
                              {u.estado === 'activo' ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {allUsers.length} usuarios · página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Importar Excel ── */}
      {activeTab === 'importar' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-base font-semibold mb-1">Importación masiva desde Excel</h3>
          <p className="text-sm text-gray-500 mb-5">
            Carga usuarios desde un archivo .xlsx. Si el usuario ya existe (por código), se actualizan sus datos.
            Los nuevos se crean con contraseña{' '}
            <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Colegio123</code> (o la que indiques en la columna Contraseña).
          </p>
          <ExcelUserImportPanel onImportDone={() => queryClient.invalidateQueries({ queryKey: ['users'] })} />
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <UserFormModal
          user={editingUser}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}

      {/* Modal sincronización Phidias */}
      {showPhidias && (
        <PhidiasSyncModal
          onClose={() => setShowPhidias(false)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
        />
      )}
    </div>
  );
};

export default UsersPage;
