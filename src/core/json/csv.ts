import Papa from 'papaparse';
import { type Json, parseJson, stringify } from './value';
function flatten(
  value: Record<string, Json>,
  path: string[] = [],
  result: Record<string, Json> = Object.create(null),
): Record<string, Json> {
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
        item;
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
  if (!rows.length || !fields.length)
    throw new Error('CSV로 변환할 데이터나 컬럼이 없습니다. 필드가 있는 객체 배열을 입력하세요.');
  const selected = columns ?? fields;
  if (!selected.length) throw new Error('CSV 컬럼을 하나 이상 선택하세요.');
  if (selected.some((key) => !key.trim()))
    throw new Error(
      'CSV Header는 비어 있거나 공백만으로 구성될 수 없습니다. JSON 키를 확인하세요.',
    );
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
export function fromCsv(text: string, delimiter = ',', infer = false, skipEmptyRows = false): Json {
  if (new TextEncoder().encode(text).length > 1024 * 1024)
    throw new Error('CSV 입력 제한은 1 MiB입니다.');
  // Papa's skipEmptyLines also discards quoted empty cells. Retain those cells
  // and skip only truly empty, unquoted records when explicitly requested.
  const input = text.replace(/^\uFEFF/, '');
  const records: { cells: string[]; number: number }[] = [];
  let cursor = 0,
    number = 0;
  const result = Papa.parse<string[]>(input, {
    delimiter,
    skipEmptyLines: false,
    step(record) {
      number++;
      if (record.errors.length)
        throw new Error(
          record.errors.map((error) => `CSV 레코드 ${number}: ${error.message}`).join('\n'),
        );
      const raw = input.slice(cursor, record.meta.cursor);
      cursor = record.meta.cursor;
      if (raw === '' && /[\r\n]$/.test(input)) return;
      if (skipEmptyRows && raw.replace(/(?:\r\n|\r|\n)$/, '') === '') return;
      records.push({ cells: record.data, number });
    },
  });
  if (result.errors.length)
    throw new Error(result.errors.map((e) => `행 ${e.row ?? '?'}: ${e.message}`).join('\n'));
  const [header, ...rows] = records;
  const headers = header?.cells;
  if (
    !headers?.length ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => !h.trim())
  )
    throw new Error('CSV Header가 비어 있거나 중복되었습니다.');
  return rows.map(({ cells: row, number }) => {
    if (row.length !== headers.length)
      throw new Error(`CSV 레코드 ${number}: 컬럼 수가 Header와 다릅니다.`);
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
