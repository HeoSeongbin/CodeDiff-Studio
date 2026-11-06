import Papa from 'papaparse';
import { type Json, parseJson, stringify } from './value';
function flatten(
  value: Record<string, Json>,
  path: string[] = [],
  result: Record<string, string> = Object.create(null),
): Record<string, string> {
  for (const [key, item] of Object.entries(value)) {
    const segments = [...path, key];
    if (
      item !== null &&
      !Array.isArray(item) &&
      typeof item === 'object' &&
      Object.keys(item).length
    )
      flatten(item, segments, result);
    else
      result['/' + segments.map((k) => k.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')] =
        typeof item === 'string' ? item : stringify(item, 0);
  }
  return result;
}
export function csvColumns(
  value: Json,
  nested: boolean,
): { rows: Record<string, Json | string>[]; fields: string[] } {
  if (
    !Array.isArray(value) ||
    !value.every((row) => row !== null && !Array.isArray(row) && typeof row === 'object')
  )
    throw new Error('JSON → CSV는 객체 배열을 입력하세요.');
  const rows = (value as Record<string, Json>[]).map((row) => (nested ? flatten(row) : row));
  return { rows, fields: [...new Set(rows.flatMap(Object.keys))] };
}
export function toCsv(value: Json, nested: boolean, columns?: string[], delimiter = ','): string {
  const { rows, fields } = csvColumns(value, nested);
  const selected = columns ?? fields;
  if (selected.some((key) => !fields.includes(key)) || new Set(selected).size !== selected.length)
    throw new Error('컬럼 선택 또는 중복을 확인하세요.');
  return Papa.unparse(
    {
      fields: selected,
      data: rows.map((row) =>
        selected.map((key) => {
          const value = Object.hasOwn(row, key) ? row[key] : '';
          return typeof value === 'object' ? stringify(value, 0) : value;
        }),
      ),
    },
    { delimiter, escapeFormulae: true, quotes: (value) => value === '' },
  );
}
export function fromCsv(text: string, delimiter = ',', infer = false): Json {
  if (new TextEncoder().encode(text).length > 1024 * 1024)
    throw new Error('CSV 입력 제한은 1 MiB입니다.');
  const result = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false });
  if (result.errors.length)
    throw new Error(result.errors.map((e) => `행 ${e.row ?? '?'}: ${e.message}`).join('\n'));
  if (/[\r\n]$/.test(text) && result.data.at(-1)?.length === 1 && result.data.at(-1)?.[0] === '')
    result.data.pop();
  const [headers, ...rows] = result.data;
  if (
    !headers?.length ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => !h.trim())
  )
    throw new Error('CSV Header가 비어 있거나 중복되었습니다.');
  return rows.map((row, index) => {
    if (row.length !== headers.length)
      throw new Error(`CSV 행 ${index + 2}: 컬럼 수가 Header와 다릅니다.`);
    return Object.fromEntries(
      headers.map((key, i) => {
        let value: Json = row[i];
        if (
          infer &&
          /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(value)
        ) {
          try {
            value = parseJson(value);
          } catch {
            /* Preserve unsafe numeric literals as strings. */
          }
        }
        return [key, value];
      }),
    );
  });
}
