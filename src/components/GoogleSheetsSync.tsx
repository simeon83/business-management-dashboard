import { useState, useCallback, useEffect } from 'react';
import { useGoogleSheets, extractSpreadsheetId } from '@/hooks/useGoogleSheets';
import {
  ENTITY_CONFIG,
  ENTITY_OPTIONS,
  autoMapColumns,
  importToSupabase,
  exportFromSupabase,
  type EntityType,
  type ImportResult,
} from '@/lib/sheetSync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileSpreadsheet, RefreshCw, Upload, Download, Loader2, Check, AlertCircle, Unlink } from 'lucide-react';

interface SheetMapping {
  entityType: EntityType | null;
  headers: string[];
  columnMapping: Record<string, string | null>;
  values: string[][] | null;
}

interface GoogleSheetsSyncProps {
  businessId: string;
  canWrite: boolean;
  onDataSynced?: () => void;
}

const STORAGE_KEY = 'gs_sync_config';

export function GoogleSheetsSync({ businessId, canWrite, onDataSynced }: GoogleSheetsSyncProps) {
  const {
    isConnected,
    isConnecting,
    authError,
    clientIdConfigured,
    connect,
    disconnect,
    getSpreadsheetSheets,
    getSheetValues,
    updateSheetValues,
  } = useGoogleSheets();

  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetMappings, setSheetMappings] = useState<Record<string, SheetMapping>>({});
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState<Record<string, ImportResult | string>>({});
  const [error, setError] = useState<string | null>(null);

  // Restore config from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const config = JSON.parse(stored);
        if (config.spreadsheetId) {
          setSpreadsheetId(config.spreadsheetId);
          setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`);
        }
        if (config.sheetNames) setSheetNames(config.sheetNames);
        if (config.sheetMappings) setSheetMappings(config.sheetMappings);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Persist config to localStorage
  useEffect(() => {
    if (spreadsheetId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ spreadsheetId, sheetNames, sheetMappings }));
    }
  }, [spreadsheetId, sheetNames, sheetMappings]);

  const handleLoadSheets = useCallback(async () => {
    const id = extractSpreadsheetId(spreadsheetUrl);
    if (!id) {
      setError('Invalid spreadsheet URL');
      return;
    }
    setError(null);
    setLoadingSheets(true);
    try {
      const names = await getSpreadsheetSheets(id);
      setSpreadsheetId(id);
      setSheetNames(names);
      // Keep existing mappings for sheets that still exist, init the rest
      const newMappings: Record<string, SheetMapping> = {};
      for (const name of names) {
        newMappings[name] =
          sheetMappings[name] || { entityType: null, headers: [], columnMapping: {}, values: null };
      }
      setSheetMappings(newMappings);
      setResults({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spreadsheet');
    } finally {
      setLoadingSheets(false);
    }
  }, [spreadsheetUrl, sheetMappings, getSpreadsheetSheets]);

  const handleEntityTypeChange = useCallback(
    async (sheetName: string, entityType: EntityType | null) => {
      if (!entityType) {
        setSheetMappings((prev) => ({ ...prev, [sheetName]: { ...prev[sheetName], entityType: null } }));
        return;
      }

      const existing = sheetMappings[sheetName];
      if (existing?.values) {
        // Already loaded — just recompute auto-mapping
        const autoMapping = autoMapColumns(existing.headers, entityType);
        setSheetMappings((prev) => ({
          ...prev,
          [sheetName]: { ...prev[sheetName], entityType, columnMapping: autoMapping },
        }));
      } else {
        // Set entity type first so UI shows a loading state
        setSheetMappings((prev) => ({ ...prev, [sheetName]: { ...prev[sheetName], entityType } }));
        try {
          const values = await getSheetValues(spreadsheetId, sheetName);
          const headers = values[0]?.map((h: string, i: number) => h || `Column ${i + 1}`) || [];
          const autoMapping = autoMapColumns(headers, entityType);
          setSheetMappings((prev) => ({
            ...prev,
            [sheetName]: { ...prev[sheetName], entityType, headers, values, columnMapping: autoMapping },
          }));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load sheet data');
        }
      }
    },
    [spreadsheetId, sheetMappings, getSheetValues],
  );

  const handleColumnMappingChange = useCallback(
    (sheetName: string, fieldKey: string, columnIndex: string | null) => {
      setSheetMappings((prev) => ({
        ...prev,
        [sheetName]: {
          ...prev[sheetName],
          columnMapping: { ...prev[sheetName].columnMapping, [fieldKey]: columnIndex },
        },
      }));
    },
    [],
  );

  const handleImport = useCallback(async () => {
    setImporting(true);
    setError(null);
    setResults({});
    const newResults: Record<string, ImportResult | string> = {};
    let hasData = false;

    for (const sheetName of sheetNames) {
      const mapping = sheetMappings[sheetName];
      if (!mapping?.entityType || !mapping?.values) continue;
      hasData = true;
      try {
        const result = await importToSupabase(businessId, mapping.entityType, mapping.values, mapping.columnMapping);
        newResults[sheetName] = result;
      } catch (err) {
        newResults[sheetName] = err instanceof Error ? err.message : 'Import failed';
      }
    }

    setResults(newResults);
    setImporting(false);
    if (hasData) onDataSynced?.();
  }, [sheetNames, sheetMappings, businessId, onDataSynced]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    setResults({});
    const newResults: Record<string, ImportResult | string> = {};

    for (const sheetName of sheetNames) {
      const mapping = sheetMappings[sheetName];
      if (!mapping?.entityType) continue;
      try {
        const values = await exportFromSupabase(businessId, mapping.entityType);
        await updateSheetValues(spreadsheetId, sheetName, values);
        newResults[sheetName] = { imported: 0, errors: [`Exported ${values.length - 1} rows`] };
      } catch (err) {
        newResults[sheetName] = err instanceof Error ? err.message : 'Export failed';
      }
    }

    setResults(newResults);
    setExporting(false);
  }, [sheetNames, sheetMappings, businessId, spreadsheetId, updateSheetValues]);

  const hasMappedSheets = sheetNames.some((n) => sheetMappings[n]?.entityType);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-primary" />
          Google Sheets Sync
        </h2>
        {isConnected && (
          <Button variant="outline" size="sm" onClick={disconnect}>
            <Unlink className="w-4 h-4" />
            Disconnect
          </Button>
        )}
      </div>

      {!clientIdConfigured && (
        <Card className="border-yellow-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">Google Client ID not configured</p>
                <p className="text-muted-foreground mt-1">
                  Set the <code className="px-1 py-0.5 bg-muted rounded text-xs">VITE_GOOGLE_CLIENT_ID</code> environment variable to enable Google Sheets integration.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(authError || error) && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {authError || error}
        </div>
      )}

      {!isConnected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connect your Google Account</CardTitle>
            <CardDescription>
              Connect to import records from Google Sheets into your dashboard and keep them in sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={connect} disabled={isConnecting || !clientIdConfigured}>
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {isConnecting ? 'Connecting…' : 'Connect Google Sheets'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Spreadsheet</CardTitle>
              <CardDescription>Paste your Google Sheets URL to load its tabs.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  value={spreadsheetUrl}
                  onChange={(e) => setSpreadsheetUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadSheets()}
                />
                <Button onClick={handleLoadSheets} disabled={loadingSheets || !spreadsheetUrl.trim()}>
                  {loadingSheets ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Load
                </Button>
              </div>
            </CardContent>
          </Card>

          {sheetNames.length > 0 && (
            <>
              <div className="space-y-4">
                {sheetNames.map((sheetName) => {
                  const mapping = sheetMappings[sheetName];
                  return (
                    <Card key={sheetName}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-base">{sheetName}</CardTitle>
                          <select
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                            value={mapping?.entityType || ''}
                            onChange={(e) => handleEntityTypeChange(sheetName, (e.target.value || null) as EntityType | null)}
                          >
                            <option value="">Skip this sheet</option>
                            {ENTITY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </CardHeader>

                      {mapping?.entityType && mapping?.values && (
                        <CardContent>
                          <p className="text-xs text-muted-foreground mb-3">
                            {mapping.values.length - 1} data rows · Map your columns to{' '}
                            {ENTITY_CONFIG[mapping.entityType].label} fields
                          </p>
                          <div className="space-y-2">
                            {ENTITY_CONFIG[mapping.entityType].fields.map((field) => (
                              <div key={field.key} className="flex items-center gap-3">
                                <div className="w-40 text-sm shrink-0">
                                  {field.label}
                                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                                </div>
                                <select
                                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                                  value={mapping.columnMapping[field.key] ?? ''}
                                  onChange={(e) =>
                                    handleColumnMappingChange(sheetName, field.key, e.target.value || null)
                                  }
                                >
                                  <option value="">— Not mapped —</option>
                                  {mapping.headers.map((header, idx) => (
                                    <option key={idx} value={String(idx)}>
                                      {header}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}

                      {mapping?.entityType && !mapping?.values && (
                        <CardContent>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading sheet data…
                          </p>
                        </CardContent>
                      )}

                      {results[sheetName] && (
                        <CardContent className="pt-0">
                          {typeof results[sheetName] === 'string' ? (
                            <p className="text-sm text-destructive flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" /> {results[sheetName] as string}
                            </p>
                          ) : (
                            <p className="text-sm text-green-600 flex items-center gap-1">
                              <Check className="w-4 h-4" /> {(results[sheetName] as ImportResult).imported} rows
                              imported
                              {(results[sheetName] as ImportResult).errors.length > 0 &&
                                ` (${(results[sheetName] as ImportResult).errors.length} warnings)`}
                            </p>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>

              {hasMappedSheets && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button onClick={handleImport} disabled={importing || !canWrite}>
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {importing ? 'Importing…' : 'Import from Sheets'}
                  </Button>
                  <Button onClick={handleExport} disabled={exporting || !canWrite} variant="outline">
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {exporting ? 'Exporting…' : 'Export to Sheets'}
                  </Button>
                  {!canWrite && (
                    <p className="text-sm text-muted-foreground self-center">
                      You need write permission to sync data
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
