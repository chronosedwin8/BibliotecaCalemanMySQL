import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Loader2, X, RefreshCw, Download, Table2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { booksService, type BookInsert } from '../../services/books.service';

// ─── Column definitions ───────────────────────────────────────────────────────
// Each entry: { field, label, aliases, example, notes }
const COLUMN_DEFS = [
  { field: 'codigo_barras',       label: 'Barcode / Cód. Barras', aliases: ['barcode','codigo barras','código barras','codigo_barras','cod barras','cód barras'], example: 'T 19196', notes: 'Código de barras o identificador físico' },
  { field: 'coleccion',           label: 'Colección',             aliases: ['coleccion','colección','collection'],                             example: 'General',                          notes: 'Grupo o colección del libro' },
  { field: 'numero_inventario',   label: 'N° Inventario',         aliases: ['numero inventario','n° inventario','numero_inventario','inv'],   example: 'INV-001',                          notes: '' },
  { field: 'fecha_ingreso',       label: 'Fecha Ingreso',         aliases: ['fecha ingreso','fecha_ingreso','fecha de ingreso'],               example: '2024-01-15',                       notes: 'YYYY-MM-DD o fecha Excel' },
  { field: 'formato_material',    label: 'Formato Material',      aliases: ['formato material','formato_material','formato del material'],     example: 'Libro',                            notes: '' },
  { field: 'idioma',              label: 'Idioma',                aliases: ['idioma','language','lengua'],                                     example: 'Español',                          notes: '' },
  { field: 'isbn',                label: 'ISBN',                  aliases: ['isbn'],                                                          example: '978-3-16-148410-0',                notes: '' },
  { field: 'numero_clasificacion',label: 'N° Clasificación',      aliases: ['numero clasificacion','n° clasificacion','numero_clasificacion','clasificacion'], example: '808.831 / A12 / 2024', notes: '' },
  { field: 'autor',               label: 'Autor/es',              aliases: ['autor','autores','autor/es','author'],                           example: 'García Márquez, Gabriel',          notes: '** Requerido **' },
  { field: 'titulo',              label: 'Título',                aliases: ['titulo','título','title'],                                       example: 'Cien años de soledad',             notes: '** Requerido **' },
  { field: 'titulo_paralelo',     label: 'Título Paralelo',       aliases: ['titulo paralelo','título paralelo','titulo_paralelo'],           example: '',                                 notes: '' },
  { field: 'numero_ejemplar',     label: 'Ejemplar N°',           aliases: ['ejemplar','numero ejemplar','n° ejemplar','numero_ejemplar'],    example: '1',                                notes: 'Número de copia' },
  { field: 'editorial',           label: 'Editorial',             aliases: ['editorial','publisher','editorial/casa editora'],                 example: 'Sudamericana',                     notes: '' },
  { field: 'lugar_publicacion',   label: 'Lugar Publicación',     aliases: ['lugar publicacion','lugar_publicacion','lugar de publicacion'],   example: 'Buenos Aires',                     notes: '' },
  { field: 'mencion_serie',       label: 'Mención de Serie',      aliases: ['mencion serie','mención de serie','mencion_serie','serie'],       example: 'Clásicos',                         notes: '' },
  { field: 'anio_publicacion',    label: 'Año Publicación',       aliases: ['año publicacion','año de publicacion','anio_publicacion','año','year','año publicación'], example: '2001', notes: '' },
  { field: 'numero_paginas',      label: 'N° de Páginas',         aliases: ['numero paginas','n° de paginas','numero_paginas','paginas','páginas'], example: '432',                       notes: '' },
  { field: 'terminos_tematicos',  label: 'Términos Temáticos',    aliases: ['terminos tematicos','términos temáticos','terminos_tematicos','temas','keywords'], example: 'Novela; Realismo mágico; Colombia', notes: '' },
  { field: 'fecha_adquisicion',   label: 'Fecha Adquisición',     aliases: ['fecha adquisicion','fecha_adquisicion','fecha de adquisicion'],   example: '2024-03-01',                       notes: 'YYYY-MM-DD o fecha Excel' },
  { field: 'precio',              label: 'Precio',                aliases: ['precio','price'],                                                example: '45000',                            notes: 'Numérico' },
  { field: 'orden_compra',        label: 'Orden de Compra',       aliases: ['orden compra','orden_compra','orden de compra','oc'],             example: 'OC-2024-001',                      notes: '' },
  { field: 'nota',                label: 'Nota',                  aliases: ['nota','notas','notes'],                                          example: '',                                 notes: '' },
  { field: 'resena',              label: 'Reseña',                aliases: ['resena','reseña','descripcion','descripción','synopsis'],        example: 'Obra maestra del realismo mágico latinoamericano.', notes: 'Máx. ~300 chars' },
] as const;

type FieldName = typeof COLUMN_DEFS[number]['field'];

// ─── Normalize header string for matching ────────────────────────────────────
function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9 _/°#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build header → field map from the parsed header row
function buildFieldMap(headers: string[]): Map<number, FieldName> {
  const map = new Map<number, FieldName>();
  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    for (const def of COLUMN_DEFS) {
      if (def.aliases.some((a) => normalizeHeader(a) === norm)) {
        if (!map.has(idx)) map.set(idx, def.field);
        break;
      }
    }
  });
  return map;
}

// ─── Value converters ─────────────────────────────────────────────────────────
function excelDateToISO(val: unknown): string | null {
  if (val == null) return null;
  // Already a string date
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  if (typeof val !== 'number' || isNaN(val)) return null;
  const d = new Date((val - 25569) * 86400 * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function cleanStr(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).replace(/\r?\n/g, ' ').trim();
  return s || null;
}

function toInt(val: unknown): number | null {
  if (val == null) return null;
  const n = parseInt(String(val));
  return isNaN(n) ? null : n;
}

function toFloat(val: unknown): number | null {
  if (val == null) return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ─── Build BookInsert from a row + field map ──────────────────────────────────
function rowToBook(row: unknown[], fieldMap: Map<number, FieldName>): BookInsert | null {
  const vals: Partial<Record<FieldName, unknown>> = {};
  fieldMap.forEach((field, idx) => { vals[field] = row[idx]; });

  const titulo = cleanStr(vals.titulo);
  const autor = cleanStr(vals.autor);
  if (!titulo || !autor) return null;

  return {
    titulo,
    autor,
    codigo_barras: cleanStr(vals.codigo_barras),
    isbn: cleanStr(vals.isbn),
    editorial: cleanStr(vals.editorial),
    anio_publicacion: toInt(vals.anio_publicacion),
    cantidad_total: 1,
    cantidad_disponible: 1,
    estado: 'disponible',
    coleccion: cleanStr(vals.coleccion),
    numero_inventario: cleanStr(vals.numero_inventario),
    fecha_ingreso: excelDateToISO(vals.fecha_ingreso),
    formato_material: cleanStr(vals.formato_material),
    idioma: cleanStr(vals.idioma) ?? 'Español',
    numero_clasificacion: cleanStr(vals.numero_clasificacion),
    titulo_paralelo: cleanStr(vals.titulo_paralelo),
    numero_ejemplar: toInt(vals.numero_ejemplar) ?? 1,
    lugar_publicacion: cleanStr(vals.lugar_publicacion),
    mencion_serie: cleanStr(vals.mencion_serie),
    numero_paginas: cleanStr(vals.numero_paginas),
    terminos_tematicos: cleanStr(vals.terminos_tematicos),
    fecha_adquisicion: excelDateToISO(vals.fecha_adquisicion),
    precio: toFloat(vals.precio),
    orden_compra: cleanStr(vals.orden_compra),
    nota: cleanStr(vals.nota),
    resena: cleanStr(vals.resena),
  };
}

// ─── Template download ────────────────────────────────────────────────────────
function downloadTemplate() {
  const headers = COLUMN_DEFS.map((d) => d.label);
  const example = COLUMN_DEFS.map((d) => d.example);

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // Column widths
  ws['!cols'] = COLUMN_DEFS.map((d) => ({
    wch: Math.max(d.label.length + 2, d.example.length + 2, 14),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Libros');
  XLSX.writeFile(wb, 'plantilla_libros_bibliocalem.xlsx');
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedData {
  books: BookInsert[];
  skipped: number;
  collections: string[];
  detectedFields: FieldName[];
  missingRequired: string[];
}

type ImportMode = 'add' | 'replace_collection';
const PREVIEW_ROWS = 8;

// ─── Component ────────────────────────────────────────────────────────────────
const ExcelImportPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeFileRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [fileName, setFileName] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('add');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const [showColumns, setShowColumns] = useState(false);

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

        if (rows.length < 2) {
          toast.error('El archivo está vacío o solo tiene cabeceras');
          return;
        }

        // Parse header row (row 0)
        const headerRow = (rows[0] as unknown[]).map((h) => String(h ?? ''));
        const fieldMap = buildFieldMap(headerRow);

        const detectedFields = [...new Set(fieldMap.values())];
        const missingRequired: string[] = [];
        if (!detectedFields.includes('titulo')) missingRequired.push('Título');
        if (!detectedFields.includes('autor')) missingRequired.push('Autor/es');

        const books: BookInsert[] = [];
        let skipped = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (row.every((c) => c == null || c === '')) continue; // blank row
          const book = rowToBook(row, fieldMap);
          if (book) books.push(book);
          else skipped++;
        }

        const collections = [
          ...new Set(books.map((b) => b.coleccion).filter(Boolean)),
        ] as string[];

        setParsed({ books, skipped, collections, detectedFields, missingRequired });
        setFileName(file.name);
        setResult(null);
        if (collections[0]) setSelectedCollection(collections[0]);

        if (missingRequired.length > 0) {
          toast.error(`Columnas requeridas no detectadas: ${missingRequired.join(', ')}`);
        } else {
          toast.success(`Archivo leído: ${books.length} libros detectados`);
        }
      } catch {
        toast.error('Error al leer el archivo Excel. Verifica que sea un .xlsx o .xls válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
        parseFile(file);
      } else {
        toast.error('Solo se aceptan archivos .xlsx o .xls');
      }
    },
    [parseFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  const booksToImport =
    importMode === 'replace_collection' && selectedCollection
      ? (parsed?.books ?? []).filter((b) => b.coleccion === selectedCollection)
      : (parsed?.books ?? []);

  const handleImport = async () => {
    if (!parsed || booksToImport.length === 0) return;
    if (parsed.missingRequired.length > 0) {
      toast.error('El archivo no tiene las columnas requeridas (Título, Autor/es)');
      return;
    }

    const confirmMsg =
      importMode === 'replace_collection'
        ? `¿Reemplazar todos los libros de "${selectedCollection}"? (${booksToImport.length} libros)`
        : `¿Agregar ${booksToImport.length} libros? Los existentes no serán modificados.`;
    if (!window.confirm(confirmMsg)) return;

    setIsImporting(true);
    setProgress(0);
    setResult(null);

    try {
      let res;
      if (importMode === 'replace_collection' && selectedCollection) {
        res = await booksService.bulkUpsertByCollection(
          selectedCollection, booksToImport,
          (done, total) => setProgress(Math.round((done / total) * 100))
        );
      } else {
        res = await booksService.bulkInsert(
          booksToImport,
          (done, total) => setProgress(Math.round((done / total) * 100))
        );
      }

      setResult(res);
      queryClient.invalidateQueries({ queryKey: ['books'] });

      if (res.errors.length === 0) {
        toast.success(`${res.inserted} libros importados exitosamente`);
      } else {
        toast.error(`${res.inserted} importados · ${res.errors.length} lotes fallidos`);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Error durante la importación');
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setParsed(null);
    setFileName('');
    setResult(null);
    setProgress(0);
    setSelectedCollection('');
  };

  const previewBooks = booksToImport.slice(0, PREVIEW_ROWS);

  return (
    <div className="space-y-5">

      {/* Top bar: template + column reference */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Importación masiva desde Excel</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            El archivo puede tener las columnas en cualquier orden — se detectan por nombre.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          Descargar plantilla
        </button>
      </div>

      {/* Column reference accordion */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowColumns(!showColumns)}
          className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <Table2 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Columnas reconocidas ({COLUMN_DEFS.length})
          </span>
          <span className="ml-auto text-xs text-gray-400">{showColumns ? '▲ Ocultar' : '▼ Ver'}</span>
        </button>

        {showColumns && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 w-44">Nombre en cabecera</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Ejemplo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 hidden sm:table-cell">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {COLUMN_DEFS.map((d) => (
                  <tr key={d.field} className={d.field === 'titulo' || d.field === 'autor' ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {d.label}
                      {(d.field === 'titulo' || d.field === 'autor') && (
                        <span className="ml-1 text-blue-600 font-bold">*</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500 font-mono">{d.example || '—'}</td>
                    <td className="px-3 py-2 text-gray-400 hidden sm:table-cell">{d.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-blue-700 bg-blue-50 border-t border-blue-100">
              <span className="font-bold text-blue-600">*</span> Campos requeridos. El resto son opcionales. Las columnas se detectan por nombre (sin distinción de mayúsculas ni tildes).
            </p>
          </div>
        )}
      </div>

      {/* Drop zone */}
      {!parsed && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/20 transition-colors"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-700">Arrastra el archivo Excel aquí</p>
            <p className="text-sm text-gray-500 mt-1">o haz clic para seleccionarlo (.xlsx, .xls)</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {/* Parsed: file info + validation */}
      {parsed && (
        <>
          {/* File info bar */}
          <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4">
            <FileSpreadsheet className="w-8 h-8 text-emerald-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{fileName}</p>
              <p className="text-sm text-gray-500">
                {parsed.books.length} libros · {parsed.skipped} filas omitidas · {parsed.collections.length} colecciones
                {' · '}{parsed.detectedFields.length}/{COLUMN_DEFS.length} columnas detectadas
              </p>
            </div>
            <button onClick={reset} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors" title="Quitar archivo">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Detected columns */}
          <div className={`rounded-xl p-4 border text-sm ${
            parsed.missingRequired.length > 0
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {parsed.missingRequired.length > 0 ? (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Columnas requeridas no encontradas: {parsed.missingRequired.join(', ')}</p>
                  <p className="text-xs mt-1">Asegúrate de que las cabeceras sean exactamente <strong>Título</strong> y <strong>Autor/es</strong> (o equivalentes). Descarga la plantilla para ver el formato correcto.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Columnas detectadas correctamente</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {COLUMN_DEFS.map((d) => (
                      <span
                        key={d.field}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          parsed.detectedFields.includes(d.field)
                            ? 'bg-emerald-200 text-emerald-800'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {parsed.detectedFields.includes(d.field) ? '✓' : '○'} {d.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Import mode */}
          {parsed.missingRequired.length === 0 && (
            <>
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="font-semibold text-gray-800 text-sm">Modo de importación</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                    importMode === 'add' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="importMode" value="add" checked={importMode === 'add'} onChange={() => setImportMode('add')} className="mt-1" />
                    <div>
                      <p className="font-medium text-gray-800 text-sm">Agregar todos</p>
                      <p className="text-xs text-gray-500 mt-0.5">Inserta los {parsed.books.length} libros sin eliminar los existentes.</p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                    importMode === 'replace_collection' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="importMode" value="replace_collection" checked={importMode === 'replace_collection'} onChange={() => setImportMode('replace_collection')} className="mt-1" />
                    <div>
                      <p className="font-medium text-gray-800 text-sm">Reemplazar colección</p>
                      <p className="text-xs text-gray-500 mt-0.5">Elimina los libros de la colección elegida y los reimporta.</p>
                    </div>
                  </label>
                </div>

                {importMode === 'replace_collection' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Colección a reemplazar</label>
                    <select
                      value={selectedCollection}
                      onChange={(e) => setSelectedCollection(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-400 outline-none text-sm"
                    >
                      <option value="">Selecciona una colección…</option>
                      {parsed.collections.map((c) => (
                        <option key={c} value={c}>{c} ({parsed.books.filter((b) => b.coleccion === c).length} libros)</option>
                      ))}
                    </select>
                    {selectedCollection && (
                      <p className="mt-1.5 text-xs text-orange-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Se eliminarán los libros actuales de "{selectedCollection}" antes de importar.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Preview table */}
              {previewBooks.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="font-semibold text-gray-800 text-sm">
                      Vista previa — {booksToImport.length} libros a importar
                    </p>
                    <span className="text-xs text-gray-400">
                      Mostrando {Math.min(PREVIEW_ROWS, booksToImport.length)} de {booksToImport.length}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Título</th>
                          <th className="px-3 py-2 text-left">Autor</th>
                          <th className="px-3 py-2 text-left">Colección</th>
                          <th className="px-3 py-2 text-left">Idioma</th>
                          <th className="px-3 py-2 text-left">Año</th>
                          <th className="px-3 py-2 text-left">Ej.</th>
                          <th className="px-3 py-2 text-left">Reseña</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewBooks.map((b, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 max-w-[180px] truncate font-medium text-gray-800">{b.titulo}</td>
                            <td className="px-3 py-2 max-w-[140px] truncate text-gray-600">{b.autor}</td>
                            <td className="px-3 py-2 max-w-[110px] truncate text-gray-500">{b.coleccion ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{b.idioma ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{b.anio_publicacion ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-500 text-center">{b.numero_ejemplar ?? 1}</td>
                            <td className="px-3 py-2 max-w-[160px] truncate text-gray-400 text-xs italic">{b.resena ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Progress */}
              {isImporting && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Importando… {progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* Result */}
              {result && !isImporting && (
                <div className={`rounded-xl p-4 flex items-start gap-3 ${
                  result.errors.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  {result.errors.length === 0
                    ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />}
                  <div className="text-sm">
                    <p className="font-semibold">
                      {result.inserted} libros importados
                      {result.errors.length > 0 && ` · ${result.errors.length} lotes con error`}
                    </p>
                    {result.errors.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-yellow-800 text-xs">
                        {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => changeFileRef.current?.click()}
                  disabled={isImporting}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Cambiar archivo
                </button>
                <input ref={changeFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />

                <button
                  onClick={handleImport}
                  disabled={
                    isImporting || booksToImport.length === 0 ||
                    (importMode === 'replace_collection' && !selectedCollection)
                  }
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                    importMode === 'replace_collection'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isImporting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Upload className="w-4 h-4" />}
                  {importMode === 'replace_collection'
                    ? `Reemplazar colección (${booksToImport.length})`
                    : `Importar ${booksToImport.length} libros`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ExcelImportPanel;
