import { useState, useCallback, useRef, useEffect } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const GIS_URL = 'https://accounts.google.com/gsi/client';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; expires_in?: number }) => void;
            error_callback?: (err: { message?: string }) => void;
          }) => { requestAccessToken: (opts: { prompt?: string }) => void };
        };
      };
    };
  }
}

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${GIS_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/** Extract a spreadsheet ID from a full Google Sheets URL or accept a raw ID. */
export function extractSpreadsheetId(input: string): string | null {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  const trimmed = input.trim();
  return trimmed || null;
}

export function useGoogleSheets() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const tokenClientRef = useRef<ReturnType<NonNullable<Window['google']>['accounts']['oauth2']['initTokenClient']> | null>(null);
  const callbackRef = useRef<(token: string | null, error?: string) => void>(() => {});

  // Restore token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('gs_token');
    const expires = localStorage.getItem('gs_token_expires');
    if (stored && expires && Date.now() < parseInt(expires)) {
      setAccessToken(stored);
    } else {
      localStorage.removeItem('gs_token');
      localStorage.removeItem('gs_token_expires');
    }
  }, []);

  const ensureTokenClient = useCallback(() => {
    if (tokenClientRef.current) return;
    if (!window.google?.accounts?.oauth2) return;
    if (!GOOGLE_CLIENT_ID) return;

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.access_token) {
          setAccessToken(response.access_token);
          const expiresAt = Date.now() + (response.expires_in || 3600) * 1000;
          localStorage.setItem('gs_token', response.access_token);
          localStorage.setItem('gs_token_expires', String(expiresAt));
          callbackRef.current(response.access_token);
        } else {
          callbackRef.current(null, 'No access token received');
        }
      },
      error_callback: (err) => {
        callbackRef.current(null, err?.message || 'OAuth error');
      },
    });
  }, []);

  const connect = useCallback(async () => {
    setAuthError(null);
    if (!GOOGLE_CLIENT_ID) {
      const msg = 'Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in your environment.';
      setAuthError(msg);
      throw new Error(msg);
    }
    setIsConnecting(true);
    try {
      await loadGsiScript();
      ensureTokenClient();
      await new Promise<string>((resolve, reject) => {
        callbackRef.current = (token, error) => {
          callbackRef.current = () => {};
          if (token) resolve(token);
          else reject(new Error(error));
        };
        tokenClientRef.current!.requestAccessToken({ prompt: 'consent' });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      setAuthError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [ensureTokenClient]);

  const disconnect = useCallback(() => {
    if (accessToken) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, { method: 'POST' }).catch(() => {});
    }
    setAccessToken(null);
    localStorage.removeItem('gs_token');
    localStorage.removeItem('gs_token_expires');
  }, [accessToken]);

  const apiCall = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!accessToken) throw new Error('Not connected to Google Sheets');
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Google API error: ${res.status}`);
      }
      return res.json();
    },
    [accessToken],
  );

  const getSpreadsheetSheets = useCallback(
    async (spreadsheetId: string): Promise<string[]> => {
      const data = await apiCall(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`);
      return (data.sheets || []).map((s: { properties?: { title?: string } }) => s.properties?.title).filter(Boolean);
    },
    [apiCall],
  );

  const getSheetValues = useCallback(
    async (spreadsheetId: string, sheetName: string): Promise<string[][]> => {
      const range = `${sheetName}!A1:Z100000`;
      const data = await apiCall(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}`);
      return data.values || [];
    },
    [apiCall],
  );

  const updateSheetValues = useCallback(
    async (spreadsheetId: string, sheetName: string, values: string[][]) => {
      // Clear existing data first
      await apiCall(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName + '!A1:Z100000')}:clear`, {
        method: 'POST',
      });
      // Write new values
      if (values.length > 0) {
        await apiCall(
          `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName + '!A1')}?valueInputOption=RAW`,
          { method: 'PUT', body: JSON.stringify({ values }) },
        );
      }
    },
    [apiCall],
  );

  return {
    isConnected: !!accessToken,
    isConnecting,
    authError,
    clientIdConfigured: !!GOOGLE_CLIENT_ID,
    connect,
    disconnect,
    getSpreadsheetSheets,
    getSheetValues,
    updateSheetValues,
  };
}
