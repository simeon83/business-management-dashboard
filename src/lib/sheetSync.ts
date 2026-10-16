import { supabase } from '@/lib/supabase';

export type EntityType = 'customers' | 'products' | 'sales' | 'expenses';

export interface FieldConfig {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'number' | 'date' | 'boolean';
  default?: unknown;
}

export interface EntityConfig {
  label: string;
  fields: FieldConfig[];
}

export const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  customers: {
    label: 'Customers',
    fields: [
      { key: 'name', label: 'Name', required: true, type: 'text' },
      { key: 'email', label: 'Email', required: false, type: 'text' },
      { key: 'phone', label: 'Phone', required: false, type: 'text' },
      { key: 'address', label: 'Address', required: false, type: 'text' },
      { key: 'city', label: 'City', required: false, type: 'text' },
      { key: 'country', label: 'Country', required: false, type: 'text' },
      { key: 'customer_type', label: 'Customer Type', required: false, type: 'text', default: 'regular' },
      { key: 'credit_limit', label: 'Credit Limit', required: false, type: 'number', default: 0 },
      { key: 'total_purchases', label: 'Total Purchases', required: false, type: 'number', default: 0 },
      { key: 'active', label: 'Active', required: false, type: 'boolean', default: true },
    ],
  },
  products: {
    label: 'Products',
    fields: [
      { key: 'name', label: 'Name', required: true, type: 'text' },
      { key: 'description', label: 'Description', required: false, type: 'text' },
      { key: 'sku', label: 'SKU', required: false, type: 'text' },
      { key: 'category', label: 'Category', required: true, type: 'text' },
      { key: 'unit_price', label: 'Unit Price', required: true, type: 'number' },
      { key: 'cost_price', label: 'Cost Price', required: false, type: 'number' },
      { key: 'active', label: 'Active', required: false, type: 'boolean', default: true },
    ],
  },
  sales: {
    label: 'Sales',
    fields: [
      { key: 'sale_date', label: 'Sale Date', required: true, type: 'date' },
      { key: 'total_amount', label: 'Total Amount', required: true, type: 'number' },
      { key: 'tax_amount', label: 'Tax Amount', required: false, type: 'number', default: 0 },
      { key: 'discount_amount', label: 'Discount Amount', required: false, type: 'number', default: 0 },
      { key: 'payment_status', label: 'Payment Status', required: false, type: 'text', default: 'pending' },
      { key: 'payment_method', label: 'Payment Method', required: false, type: 'text' },
      { key: 'notes', label: 'Notes', required: false, type: 'text' },
    ],
  },
  expenses: {
    label: 'Expenses',
    fields: [
      { key: 'category', label: 'Category', required: true, type: 'text' },
      { key: 'amount', label: 'Amount', required: true, type: 'number' },
      { key: 'expense_date', label: 'Expense Date', required: true, type: 'date' },
      { key: 'description', label: 'Description', required: false, type: 'text' },
      { key: 'payment_method', label: 'Payment Method', required: false, type: 'text' },
      { key: 'status', label: 'Status', required: false, type: 'text', default: 'pending' },
    ],
  },
};

export const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'customers', label: 'Customers' },
  { value: 'products', label: 'Products' },
  { value: 'sales', label: 'Sales' },
  { value: 'expenses', label: 'Expenses' },
];

/** Auto-detect column mapping by matching sheet headers to entity field names/labels. */
export function autoMapColumns(headers: string[], entityType: EntityType): Record<string, string | null> {
  const config = ENTITY_CONFIG[entityType];
  const mapping: Record<string, string | null> = {};
  for (const field of config.fields) {
    const keyLower = field.key.toLowerCase();
    const labelLower = field.label.toLowerCase();
    const keySpaced = keyLower.replace(/_/g, ' ');

    let idx = headers.findIndex((h) => h.toLowerCase().trim() === keyLower);
    if (idx === -1) idx = headers.findIndex((h) => h.toLowerCase().trim() === labelLower);
    if (idx === -1) idx = headers.findIndex((h) => h.toLowerCase().trim() === keySpaced);
    if (idx === -1)
      idx = headers.findIndex(
        (h) => h.toLowerCase().includes(keySpaced) || h.toLowerCase().includes(labelLower),
      );

    mapping[field.key] = idx !== -1 ? String(idx) : null;
  }
  return mapping;
}

function parseValue(raw: string | undefined, type: string): unknown {
  if (raw === undefined || raw === '') return null;
  const str = String(raw).trim();
  switch (type) {
    case 'number': {
      const cleaned = str.replace(/[$,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }
    case 'boolean': {
      const lower = str.toLowerCase();
      if (['true', 'yes', '1', 'active', 'y'].includes(lower)) return true;
      if (['false', 'no', '0', 'inactive', 'n'].includes(lower)) return false;
      return null;
    }
    case 'date': {
      const d = new Date(str);
      return isNaN(d.getTime()) ? str : d.toISOString();
    }
    default:
      return str;
  }
}

export interface ImportResult {
  imported: number;
  errors: string[];
}

/** Parse sheet values using the column mapping and insert rows into Supabase. */
export async function importToSupabase(
  businessId: string,
  entityType: EntityType,
  values: string[][],
  columnMapping: Record<string, string | null>,
): Promise<ImportResult> {
  const config = ENTITY_CONFIG[entityType];
  if (values.length < 2) return { imported: 0, errors: ['Sheet has no data rows'] };

  const rows: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every((c) => c === '' || c === undefined)) continue;

    const obj: Record<string, unknown> = { business_id: businessId };
    let missing = false;

    for (const field of config.fields) {
      const colIdx = columnMapping[field.key];
      if (colIdx === null || colIdx === undefined) {
        if (field.required) {
          missing = true;
          break;
        }
        if (field.default !== undefined) obj[field.key] = field.default;
        continue;
      }
      const parsed = parseValue(row[parseInt(colIdx)], field.type);
      if (field.required && (parsed === null || parsed === undefined || parsed === '')) {
        missing = true;
        break;
      }
      obj[field.key] = parsed;
    }

    if (missing) {
      errors.push(`Row ${i + 1}: missing required field(s)`);
    } else {
      rows.push(obj);
    }
  }

  if (rows.length === 0) return { imported: 0, errors };

  const { error } = await supabase.from(entityType).insert(rows);
  if (error) {
    return { imported: 0, errors: [...errors, `Database error: ${error.message}`] };
  }

  return { imported: rows.length, errors };
}

/** Fetch all rows for an entity from Supabase and format as a 2D array for Google Sheets. */
export async function exportFromSupabase(
  businessId: string,
  entityType: EntityType,
): Promise<string[][]> {
  const config = ENTITY_CONFIG[entityType];
  const { data, error } = await supabase
    .from(entityType)
    .select('*')
    .eq('business_id', businessId);
  if (error || !data) return [];

  const headers = config.fields.map((f) => f.label);
  const rows: string[][] = [headers];

  for (const item of data) {
    rows.push(
      config.fields.map((f) => {
        const val = item[f.key];
        if (val === null || val === undefined) return '';
        if (f.type === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (f.type === 'date') {
          try {
            return new Date(val).toLocaleDateString();
          } catch {
            return String(val);
          }
        }
        return String(val);
      }),
    );
  }

  return rows;
}
