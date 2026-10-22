'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  History,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileUp,
  Database,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface EntityCatalog {
  import: string[];
  export: string[];
  templates: Record<string, string[]>;
}

interface ImportError {
  row?: number | null;
  field?: string | null;
  message: string;
}

interface ImportPreview {
  entity: string;
  file_name: string;
  sheet_name: string;
  headers: string[];
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  rows: Record<string, unknown>[];
  errors: ImportError[];
  warnings: string[];
  totals?: Record<string, number>;
  investments?: Record<string, unknown>[];
  olx?: Record<string, unknown>;
  medicare_items?: Record<string, unknown>[];
}

interface ImportResult {
  batch_id?: string;
  entity: string;
  file_name: string;
  rows_total: number;
  rows_imported: number;
  rows_skipped: number;
  rows_failed: number;
  errors: ImportError[];
  summary: Record<string, unknown>;
}

interface ImportBatchRow {
  id: string;
  source_file: string;
  source_sheet?: string | null;
  import_type: string;
  status: string;
  rows_total: number;
  rows_imported: number;
  rows_skipped: number;
  rows_failed: number;
  summary?: Record<string, unknown>;
  notes?: string | null;
  created_at: string;
}

interface MonthSummaryRow {
  period: string;
  period_year: number;
  period_month: number;
  total_sales: number;
  total_purchase: number;
  total_purchase_out: number;
  total_profit: number;
  total_discount: number;
  total_expense: number;
  closing_balance_units: number;
}

interface ImportHistory {
  batches: number;
  sales_rows: number;
  performance_rows: number;
  total_imported_sales: number;
  source_file?: string | null;
  months: MonthSummaryRow[];
}

const ENTITY_LABELS: Record<string, string> = {
  medicines: 'Medicines',
  customers: 'Customers & Doctors',
  suppliers: 'Suppliers',
  inventory: 'Inventory Batches',
  sales: 'Sales Invoices',
  purchases: 'Purchase Invoices',
  expenses: 'Expenses',
  investments: 'Doctor Investments',
  'sales-history': 'Imported Sales History',
  'month-summary': 'Monthly Summary',
};

const IMPORT_HELP: Record<string, string> = {
  medicines:
    'Product master upsert by product code. Existing product codes are skipped, so re-running is safe.',
  customers:
    'Customer/doctor master upsert by name. Existing names are skipped, so re-running is safe.',
  suppliers:
    'Supplier master upsert by name. Existing names are skipped, so re-running is safe.',
  'sales-history':
    'Historical month-wise product performance. Rows are upserted by year + month + product code.',
};

function label(value: string) {
  return ENTITY_LABELS[value] || value.replace(/-/g, ' ');
}

function cellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parseFilename(disposition?: string, fallback = 'export.xlsx') {
  if (!disposition) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1] || fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function DynamicTable({
  rows,
  empty = 'No rows to display',
}: {
  rows: Record<string, unknown>[];
  empty?: string;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  const columns = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );
  return (
    <div className="max-h-[420px] overflow-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column} className="whitespace-nowrap capitalize">
                {column.replace(/_/g, ' ')}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column} className="whitespace-nowrap text-xs">
                  {cellValue(row[column])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ImportExportPage() {
  const [catalog, setCatalog] = useState<EntityCatalog | null>(null);

  // Generic entity import state
  const [entity, setEntity] = useState('medicines');
  const [entityFile, setEntityFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const entityInputRef = useRef<HTMLInputElement>(null);

  // Workbook seed state
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [workbookPreview, setWorkbookPreview] = useState<ImportPreview | null>(null);
  const [isWorkbookPreviewing, setIsWorkbookPreviewing] = useState(false);
  const [isWorkbookCommitting, setIsWorkbookCommitting] = useState(false);
  const [workbookResult, setWorkbookResult] = useState<ImportResult | null>(null);
  const workbookInputRef = useRef<HTMLInputElement>(null);

  // History state
  const [batches, setBatches] = useState<ImportBatchRow[]>([]);
  const [history, setHistory] = useState<ImportHistory | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadCatalog = async () => {
    try {
      const res = await api.get('/api/import-export/entities');
      setCatalog(res.data);
    } catch {
      toast.error('Failed to load import/export catalog');
    }
  };

  const loadHistory = async () => {
    try {
      setIsHistoryLoading(true);
      const [batchRes, historyRes] = await Promise.all([
        api.get('/api/import-export/batches'),
        api.get('/api/import-export/history'),
      ]);
      setBatches(batchRes.data || []);
      setHistory(historyRes.data);
    } catch {
      toast.error('Failed to load import history');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadHistory();
  }, []);

  const previewFile = async (target: File, kind: 'entity' | 'workbook') => {
    const formData = new FormData();
    formData.append('file', target);
    const url =
      kind === 'workbook'
        ? '/api/import-export/workbook/preview'
        : `/api/import-export/preview?entity=${encodeURIComponent(entity)}`;
    try {
      if (kind === 'workbook') setIsWorkbookPreviewing(true);
      else setIsPreviewing(true);
      const res = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (kind === 'workbook') {
        setWorkbookPreview(res.data);
        setWorkbookResult(null);
      } else {
        setPreview(res.data);
        setResult(null);
      }
      const invalid = res.data?.invalid_rows || 0;
      if (invalid) {
        toast.error(`Preview found ${invalid} invalid row${invalid === 1 ? '' : 's'}`);
      } else {
        toast.success(`Preview ready: ${res.data?.valid_rows || 0} valid rows`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to preview file');
    } finally {
      if (kind === 'workbook') setIsWorkbookPreviewing(false);
      else setIsPreviewing(false);
    }
  };

  const commitFile = async (target: File, kind: 'entity' | 'workbook') => {
    const formData = new FormData();
    formData.append('file', target);
    const url =
      kind === 'workbook'
        ? '/api/import-export/workbook/commit'
        : `/api/import-export/commit?entity=${encodeURIComponent(entity)}`;
    try {
      if (kind === 'workbook') setIsWorkbookCommitting(true);
      else setIsCommitting(true);
      const res = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (kind === 'workbook') setWorkbookResult(res.data);
      else setResult(res.data);
      toast.success(
        `Import complete: ${res.data?.rows_imported || 0} imported, ${
          res.data?.rows_skipped || 0
        } skipped`
      );
      await loadHistory();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to commit import');
    } finally {
      if (kind === 'workbook') setIsWorkbookCommitting(false);
      else setIsCommitting(false);
    }
  };

  const download = async (url: string, filename: string) => {
    try {
      setDownloading(url);
      const res = await api.get(url, { responseType: 'blob' });
      downloadBlob(res.data, parseFilename(res.headers['content-disposition'], filename));
      toast.success('Download started');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const templateEntity = entity;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Import & Export</h1>
            <p className="text-sm text-muted-foreground">
              Bulk load master data and historical performance, or download Excel workbooks for
              backup, analysis, and reporting.
            </p>
          </div>
          <Badge variant="outline" className="self-start sm:self-auto px-3 py-1">
            <FileSpreadsheet className="mr-1.5 inline h-4 w-4" /> Excel / CSV
          </Badge>
        </div>

        <Tabs defaultValue="import" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="import">
              <Upload className="mr-2 h-4 w-4" /> Import Data
            </TabsTrigger>
            <TabsTrigger value="workbook">
              <Database className="mr-2 h-4 w-4" /> Workbook Seed
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="mr-2 h-4 w-4" /> Export
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" /> History
            </TabsTrigger>
          </TabsList>

          {/* ------------------------------------------------------------ */}
          {/* Import                                                       */}
          {/* ------------------------------------------------------------ */}
          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Entity Import</CardTitle>
                <CardDescription>
                  Upload a CSV or XLSX file, preview validation results, then commit. Imports are
                  idempotent: existing records are skipped or updated rather than duplicated.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data type</label>
                    <select
                      className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={entity}
                      onChange={(event) => {
                        setEntity(event.target.value);
                        setPreview(null);
                        setResult(null);
                        setEntityFile(null);
                        if (entityInputRef.current) entityInputRef.current.value = '';
                      }}
                    >
                      {(catalog?.import || ['medicines', 'customers', 'suppliers', 'sales-history']).map(
                        (item) => (
                          <option key={item} value={item}>
                            {label(item)}
                          </option>
                        )
                      )}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {IMPORT_HELP[entity] || 'Preview validates every row before anything is saved.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Source file</label>
                    <input
                      ref={entityInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="block w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setEntityFile(file);
                        setPreview(null);
                        setResult(null);
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          download(
                            `/api/import-export/templates/${encodeURIComponent(templateEntity)}`,
                            `${templateEntity}-template.xlsx`
                          )
                        }
                        disabled={downloading === `/api/import-export/templates/${templateEntity}`}
                      >
                        <Download className="mr-2 h-3.5 w-3.5" /> Template
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => entityFile && previewFile(entityFile, 'entity')}
                        disabled={!entityFile || isPreviewing}
                      >
                        {isPreviewing ? (
                          <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileUp className="mr-2 h-3.5 w-3.5" />
                        )}
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => entityFile && commitFile(entityFile, 'entity')}
                        disabled={!entityFile || !preview || preview.valid_rows === 0 || isCommitting}
                      >
                        {isCommitting ? (
                          <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                        )}
                        Commit Import
                      </Button>
                    </div>
                  </div>
                </div>

                {preview && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="secondary">{preview.file_name}</Badge>
                      <Badge variant="outline">Sheet: {preview.sheet_name}</Badge>
                      <Badge variant="outline">{preview.total_rows} rows</Badge>
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        {preview.valid_rows} valid
                      </Badge>
                      {preview.invalid_rows > 0 && (
                        <Badge variant="destructive">{preview.invalid_rows} invalid</Badge>
                      )}
                    </div>
                    {preview.warnings.map((warning, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                    {preview.errors.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-destructive">
                          Validation issues ({preview.errors.length})
                        </p>
                        <div className="max-h-48 overflow-auto rounded-md border">
                          <Table>
                            <TableBody>
                              {preview.errors.slice(0, 100).map((error, index) => (
                                <TableRow key={index}>
                                  <TableCell className="w-20 text-xs font-mono">
                                    {error.row ?? '—'}
                                  </TableCell>
                                  <TableCell className="w-36 text-xs">{error.field || '—'}</TableCell>
                                  <TableCell className="text-xs">{error.message}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                    <DynamicTable rows={preview.rows} empty="No valid rows parsed" />
                  </div>
                )}

                {result && <ImportResultCard result={result} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------------------------------------------------------------ */}
          {/* Workbook seed                                                */}
          {/* ------------------------------------------------------------ */}
          <TabsContent value="workbook" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sale Sheet Workbook Seed</CardTitle>
                <CardDescription>
                  Seed the system from the <code className="text-xs">Sale Sheet MA-Na.xlsx</code>{' '}
                  workbook. This creates products, customers, opening stock batches, doctor
                  investments, and month-wise historical sales performance. Historical sales are
                  imported as performance records only and do not create sales invoices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <input
                    ref={workbookInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="block w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setWorkbookFile(file);
                      setWorkbookPreview(null);
                      setWorkbookResult(null);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => workbookFile && previewFile(workbookFile, 'workbook')}
                      disabled={!workbookFile || isWorkbookPreviewing}
                    >
                      {isWorkbookPreviewing ? (
                        <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileUp className="mr-2 h-3.5 w-3.5" />
                      )}
                      Preview Workbook
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => workbookFile && commitFile(workbookFile, 'workbook')}
                      disabled={!workbookFile || !workbookPreview || isWorkbookCommitting}
                    >
                      {isWorkbookCommitting ? (
                        <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                      )}
                      Commit Workbook
                    </Button>
                  </div>
                </div>

                {workbookPreview && (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric
                        title="Months"
                        value={workbookPreview.totals?.months ?? '—'}
                      />
                      <Metric
                        title="Products"
                        value={workbookPreview.totals?.products ?? '—'}
                      />
                      <Metric
                        title="Sales rows"
                        value={workbookPreview.totals?.sales_rows ?? '—'}
                      />
                      <Metric
                        title="Total sales"
                        value={formatCurrency(workbookPreview.totals?.total_sales || 0)}
                      />
                    </div>
                    {(workbookPreview.warnings || []).map((warning, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                    <div>
                      <p className="mb-2 text-sm font-medium">Month summaries</p>
                      <DynamicTable rows={workbookPreview.rows} />
                    </div>
                    {!!workbookPreview.investments?.length && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Doctor investments</p>
                        <DynamicTable rows={workbookPreview.investments} />
                      </div>
                    )}
                  </div>
                )}

                {workbookResult && <ImportResultCard result={workbookResult} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------------------------------------------------------------ */}
          {/* Export                                                       */}
          {/* ------------------------------------------------------------ */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export Data</CardTitle>
                <CardDescription>
                  Download a formatted XLSX workbook. Exports reflect the current database,
                  including imported historical performance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(catalog?.export || []).map((item) => {
                    const url = `/api/import-export/exports/${encodeURIComponent(item)}`;
                    return (
                      <div
                        key={item}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{label(item)}</p>
                          <p className="text-xs text-muted-foreground">XLSX workbook</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => download(url, `${item}.xlsx`)}
                          disabled={downloading === url}
                        >
                          {downloading === url ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------------------------------------------------------------ */}
          {/* History                                                      */}
          {/* ------------------------------------------------------------ */}
          <TabsContent value="history" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Import History</h2>
                <p className="text-xs text-muted-foreground">
                  Every import run is recorded with row counts and validation results.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={loadHistory} disabled={isHistoryLoading}>
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isHistoryLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric title="Import runs" value={history?.batches ?? '—'} />
              <Metric title="Historical sales rows" value={history?.sales_rows ?? '—'} />
              <Metric title="Customer performance rows" value={history?.performance_rows ?? '—'} />
              <Metric
                title="Imported sales"
                value={formatCurrency(history?.total_imported_sales || 0)}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly performance</CardTitle>
                <CardDescription>
                  Historical totals seeded from the workbook. These figures are reported alongside
                  live invoice data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history?.months?.length ? (
                  <div className="max-h-[420px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Purchases</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Expenses</TableHead>
                          <TableHead className="text-right">Closing units</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.months.map((month) => (
                          <TableRow key={month.period}>
                            <TableCell className="font-medium">{month.period}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(month.total_sales)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(month.total_purchase)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(month.total_profit)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(month.total_expense)}
                            </TableCell>
                            <TableCell className="text-right">
                              {month.closing_balance_units.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No historical data imported yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import runs</CardTitle>
                <CardDescription>Most recent import batches first.</CardDescription>
              </CardHeader>
              <CardContent>
                {batches.length ? (
                  <div className="max-h-[420px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Source file</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Imported</TableHead>
                          <TableHead className="text-right">Skipped</TableHead>
                          <TableHead className="text-right">Failed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batches.map((batch) => (
                          <TableRow key={batch.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDateTime(batch.created_at)}
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate text-xs">
                              {batch.source_file}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {batch.import_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={batch.rows_failed > 0 ? 'destructive' : 'secondary'}
                                className="capitalize"
                              >
                                {batch.status.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{batch.rows_total}</TableCell>
                            <TableCell className="text-right text-emerald-600">
                              {batch.rows_imported}
                            </TableCell>
                            <TableCell className="text-right text-amber-600">
                              {batch.rows_skipped}
                            </TableCell>
                            <TableCell className="text-right text-destructive">
                              {batch.rows_failed}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No import runs recorded yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function ImportResultCard({ result }: { result: ImportResult }) {
  const errors = result.errors || [];
  return (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        Import finished for {result.file_name}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric title="Rows processed" value={result.rows_total} />
        <Metric title="Imported" value={result.rows_imported} />
        <Metric title="Skipped" value={result.rows_skipped} />
        <Metric title="Failed" value={result.rows_failed} />
      </div>
      {errors.length > 0 && (
        <div className="max-h-40 overflow-auto rounded-md border bg-background">
          <Table>
            <TableBody>
              {errors.slice(0, 50).map((error, index) => (
                <TableRow key={index}>
                  <TableCell className="w-16 text-xs font-mono">{error.row ?? '—'}</TableCell>
                  <TableCell className="text-xs">{error.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
