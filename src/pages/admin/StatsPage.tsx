import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Trophy, BookOpen, Clock, TrendingUp, Loader2, ChevronDown,
} from 'lucide-react';
import { loansService, type LoanWithRelations } from '../../services/loans.service';

// ── Helpers ───────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const ROLE_LABELS: Record<string, string> = { admin: 'Admin', teacher: 'Docente', student: 'Estudiante' };
const BAR_COLORS = ['#3B82F6','#6366F1','#8B5CF6','#EC4899','#F43F5E','#F97316','#EAB308','#22C55E','#14B8A6','#06B6D4'];

function loanYear(loan: LoanWithRelations): number {
  return new Date(loan.created_at).getFullYear();
}
function loanMonth(loan: LoanWithRelations): number {
  return new Date(loan.created_at).getMonth(); // 0-based
}

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }> = ({
  icon, title, subtitle, children,
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
      <div className="p-2 bg-blue-50 rounded-xl text-blue-600">{icon}</div>
      <div>
        <h3 className="font-bold text-gray-800 text-base">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// ── Filter row ────────────────────────────────────────────────────────────────
const selectCls = 'pl-3 pr-8 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-400 outline-none appearance-none cursor-pointer';

interface FiltersProps {
  years: number[];
  year: string; setYear: (v: string) => void;
  month: string; setMonth: (v: string) => void;
  showMonth?: boolean;
}
const Filters: React.FC<FiltersProps> = ({ years, year, setYear, month, setMonth, showMonth = true }) => (
  <>
    <div className="relative">
      <select value={year} onChange={(e) => setYear(e.target.value)} className={selectCls}>
        <option value="">Todos los años</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
    {showMonth && (
      <div className="relative">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls}>
          <option value="">Todos los meses</option>
          {MONTH_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      </div>
    )}
  </>
);

// ── Main page ─────────────────────────────────────────────────────────────────
const StatsPage: React.FC = () => {
  const { data: allLoans = [], isLoading } = useQuery<LoanWithRelations[]>({
    queryKey: ['stats-all-loans'],
    queryFn: () => loansService.getAll(),
    staleTime: 5 * 60_000,
  });

  // Derive years available in data
  const availableYears = useMemo(() => {
    const set = new Set(allLoans.map(loanYear));
    return [...set].sort((a, b) => b - a);
  }, [allLoans]);

  // ── Shared filter state ──────────────────────────────────────────────────
  const [year1, setYear1] = useState('');
  const [month1, setMonth1] = useState('');
  const [role1, setRole1] = useState('');

  const [year2, setYear2] = useState('');
  const [month2, setMonth2] = useState('');

  const [year4, setYear4] = useState('');

  // ── Apply date filter ────────────────────────────────────────────────────
  function filterByDate(loans: LoanWithRelations[], y: string, m: string) {
    return loans.filter((l) => {
      if (y && loanYear(l) !== parseInt(y)) return false;
      if (m !== '' && loanMonth(l) !== parseInt(m)) return false;
      return true;
    });
  }

  // ── Stat 1: Top 10 users by loans ───────────────────────────────────────
  const top10Users = useMemo(() => {
    let loans = filterByDate(allLoans, year1, month1);
    if (role1) loans = loans.filter((l) => (l.profiles as any)?.role === role1);

    const map = new Map<string, { name: string; role: string; count: number }>();
    for (const l of loans) {
      const uid = l.usuario_id;
      const name = (l.profiles as any)?.full_name ?? 'Desconocido';
      const role = (l.profiles as any)?.role ?? '';
      if (!map.has(uid)) map.set(uid, { name, role, count: 0 });
      map.get(uid)!.count++;
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [allLoans, year1, month1, role1]);

  // ── Stat 2: Top 10 books by loans ───────────────────────────────────────
  const top10Books = useMemo(() => {
    const loans = filterByDate(allLoans, year2, month2);
    const map = new Map<string, { titulo: string; count: number }>();
    for (const l of loans) {
      const bid = l.libro_id;
      const titulo = (l.books as any)?.titulo ?? 'Desconocido';
      if (!map.has(bid)) map.set(bid, { titulo, count: 0 });
      map.get(bid)!.count++;
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [allLoans, year2, month2]);

  // ── Stat 3: Top 10 slowest returners (all time) ──────────────────────────
  const top10Slow = useMemo(() => {
    const returned = allLoans.filter(
      (l) => l.estado === 'returned' && l.fecha_devolucion_real
    );
    const map = new Map<string, { name: string; role: string; totalDays: number; maxDays: number; count: number }>();
    for (const l of returned) {
      const uid = l.usuario_id;
      const name = (l.profiles as any)?.full_name ?? 'Desconocido';
      const role = (l.profiles as any)?.role ?? '';
      const days = Math.round(
        (new Date(l.fecha_devolucion_real!).getTime() - new Date(l.created_at).getTime())
        / (1000 * 60 * 60 * 24)
      );
      if (!map.has(uid)) map.set(uid, { name, role, totalDays: 0, maxDays: 0, count: 0 });
      const entry = map.get(uid)!;
      entry.totalDays += days;
      entry.count++;
      if (days > entry.maxDays) entry.maxDays = days;
    }
    return [...map.values()]
      .map((e) => ({ ...e, avgDays: Math.round(e.totalDays / e.count) }))
      .sort((a, b) => b.maxDays - a.maxDays)
      .slice(0, 10);
  }, [allLoans]);

  // ── Stat 4: Loans per month in a year ───────────────────────────────────
  const monthlyData = useMemo(() => {
    const loans = year4 ? allLoans.filter((l) => loanYear(l) === parseInt(year4)) : allLoans;
    const counts = new Array(12).fill(0);
    for (const l of loans) counts[loanMonth(l)]++;
    return MONTH_NAMES.map((name, i) => ({ mes: name.slice(0, 3), total: counts[i] }));
  }, [allLoans, year4]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const rankBadge = (i: number) => {
    if (i === 0) return <span className="text-yellow-500 font-bold text-base">🥇</span>;
    if (i === 1) return <span className="text-gray-400 font-bold text-base">🥈</span>;
    if (i === 2) return <span className="text-amber-600 font-bold text-base">🥉</span>;
    return <span className="text-gray-400 font-mono text-sm w-5 inline-block text-center">{i + 1}</span>;
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Estadísticas</h2>
        <p className="text-sm text-gray-500 mt-1">
          Basado en {allLoans.length.toLocaleString()} registros de préstamos
        </p>
      </div>

      {/* ── 1. Top 10 usuarios ── */}
      <Section
        icon={<Trophy className="w-5 h-5" />}
        title="Top 10 Usuarios — más préstamos"
        subtitle="Filtrable por período y rol"
      >
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <Filters years={availableYears} year={year1} setYear={setYear1} month={month1} setMonth={setMonth1} />
          <div className="relative">
            <select value={role1} onChange={(e) => setRole1(e.target.value)} className={selectCls}>
              <option value="">Todos los roles</option>
              <option value="student">Estudiante</option>
              <option value="teacher">Docente</option>
              <option value="admin">Admin</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {top10Users.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Sin datos para el período seleccionado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-gray-400 uppercase border-b border-gray-100">
                  <th className="pb-2 text-center w-10">#</th>
                  <th className="pb-2 text-left">Usuario</th>
                  <th className="pb-2 text-left">Rol</th>
                  <th className="pb-2 text-right">Préstamos</th>
                  <th className="pb-2 pl-4 text-left w-48">Distribución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {top10Users.map((u, i) => {
                  const max = top10Users[0].count;
                  const pct = Math.round((u.count / max) * 100);
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 text-center">{rankBadge(i)}</td>
                      <td className="py-3 font-medium text-gray-800">{u.name}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold text-blue-600">{u.count}</td>
                      <td className="py-3 pl-4">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── 2. Top 10 libros ── */}
      <Section
        icon={<BookOpen className="w-5 h-5" />}
        title="Top 10 Libros — más prestados"
        subtitle="Filtrable por período"
      >
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <Filters years={availableYears} year={year2} setYear={setYear2} month={month2} setMonth={setMonth2} />
        </div>

        {top10Books.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Sin datos para el período seleccionado</p>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Chart */}
            <div className="w-full lg:w-1/2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...top10Books].reverse().map((b) => ({
                    titulo: b.titulo.length > 22 ? b.titulo.slice(0, 22) + '…' : b.titulo,
                    total: b.count,
                  }))}
                  layout="vertical"
                  margin={{ left: 0, right: 20, top: 4, bottom: 4 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="titulo" width={145} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [v, 'Préstamos']} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {[...top10Books].reverse().map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[top10Books.length - 1 - i] ?? '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="w-full lg:w-1/2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-gray-400 uppercase border-b border-gray-100">
                    <th className="pb-2 text-center w-10">#</th>
                    <th className="pb-2 text-left">Libro</th>
                    <th className="pb-2 text-right">Préstamos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {top10Books.map((b, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2.5 text-center">{rankBadge(i)}</td>
                      <td className="py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{b.titulo}</td>
                      <td className="py-2.5 text-right font-bold" style={{ color: BAR_COLORS[i] }}>{b.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      {/* ── 3. Top 10 más demoran en devolver ── */}
      <Section
        icon={<Clock className="w-5 h-5" />}
        title="Top 10 — Mayor tiempo de retención"
        subtitle="Historial completo · solo préstamos devueltos"
      >
        {top10Slow.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Sin préstamos devueltos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-gray-400 uppercase border-b border-gray-100">
                  <th className="pb-2 text-center w-10">#</th>
                  <th className="pb-2 text-left">Usuario</th>
                  <th className="pb-2 text-left">Rol</th>
                  <th className="pb-2 text-right">Préstamos</th>
                  <th className="pb-2 text-right">Máx. días</th>
                  <th className="pb-2 text-right">Prom. días</th>
                  <th className="pb-2 pl-4 text-left w-36">Máximo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {top10Slow.map((u, i) => {
                  const maxAll = top10Slow[0].maxDays;
                  const pct = Math.round((u.maxDays / maxAll) * 100);
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-3 text-center">{rankBadge(i)}</td>
                      <td className="py-3 font-medium text-gray-800">{u.name}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="py-3 text-right text-gray-600">{u.count}</td>
                      <td className="py-3 text-right font-bold text-red-500">{u.maxDays}d</td>
                      <td className="py-3 text-right text-gray-500">{u.avgDays}d</td>
                      <td className="py-3 pl-4">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── 4. Préstamos por mes ── */}
      <Section
        icon={<TrendingUp className="w-5 h-5" />}
        title="Préstamos por mes"
        subtitle="Total de préstamos registrados cada mes"
      >
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative">
            <select value={year4} onChange={(e) => setYear4(e.target.value)} className={selectCls}>
              <option value="">Todos los años</option>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
          {year4 && (
            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-lg">
              {monthlyData.reduce((s, m) => s + m.total, 0)} préstamos en {year4}
            </span>
          )}
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Préstamos']} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {monthlyData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary table below chart */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-xs">
            <tbody>
              <tr className="divide-x divide-gray-100">
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-2 py-1.5 text-center">
                    <p className="font-semibold text-gray-700">{m.total}</p>
                    <p className="text-gray-400 mt-0.5">{m.mes}</p>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};

export default StatsPage;
