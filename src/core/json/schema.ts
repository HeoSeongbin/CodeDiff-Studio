import Ajv, { type AnySchema, type ErrorObject } from 'ajv';
import type { Json } from './value';
import { jsonType, parseJson, stringify } from './value';
export interface InferredSchema {
  type?: string;
  properties?: Record<string, InferredSchema>;
  required?: string[];
  items?: InferredSchema;
  anyOf?: InferredSchema[];
  $schema?: string;
}
export function inferSchema(values: Json[]): InferredSchema {
  if (!values.length) return {};
  const groups = new Map<string, Json[]>();
  for (const value of values) {
    const type = jsonType(value);
    const group = groups.get(type);
    if (group) group.push(value);
    else groups.set(type, [value]);
  }
  const variants = [...groups].map(([type, samples]): InferredSchema => {
    if (type === 'object') {
      const objects = samples as Record<string, Json>[];
      const keys = [...new Set(objects.flatMap(Object.keys))];
      return {
        type,
        properties: Object.fromEntries(
          keys.map((key) => [
            key,
            inferSchema(objects.filter((v) => Object.hasOwn(v, key)).map((v) => v[key])),
          ]),
        ),
        required: keys.filter((key) => objects.every((v) => Object.hasOwn(v, key))),
      };
    }
    if (type === 'array') return { type, items: inferSchema((samples as Json[][]).flat()) };
    return { type };
  });
  return variants.length === 1 ? variants[0] : { anyOf: variants };
}
export function generateSchema(value: Json): InferredSchema {
  return { $schema: 'http://json-schema.org/draft-07/schema#', ...inferSchema([value]) };
}
export function validateSchema(
  value: Json,
  schemaText: string,
): { valid: boolean; errors: string[] } {
  const schema = parseJson(schemaText);
  if (
    typeof schema !== 'boolean' &&
    (!schema || Array.isArray(schema) || typeof schema !== 'object')
  )
    throw new Error('Schema는 객체 또는 boolean이어야 합니다.');
  // No compileAsync/loadSchema: remote refs cannot cause network requests. No coercion/default/removal.
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    strictRequired: false,
    ownProperties: true,
    validateFormats: false,
    code: { optimize: 1 },
  });
  const validate = ajv.compile(schema as AnySchema);
  const valid = validate(value) as boolean;
  return {
    valid,
    errors: (validate.errors ?? []).map(
      (error: ErrorObject) =>
        `${error.instancePath || '/'} ${error.message ?? ''} ${stringify(error.params, 0)}`,
    ),
  };
}
const reserved = new Set(
  'break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await abstract boolean number string unknown never any object type undefined bigint symbol intrinsic'.split(
    ' ',
  ),
);
export function generateTypes(
  value: Json,
  name: string,
  alias: boolean,
  exported: boolean,
): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(name) || reserved.has(name))
    throw new Error('타입명은 예약어가 아닌 유효한 TypeScript 식별자여야 합니다.');
  const declarations: string[] = [],
    used = new Set<string>([name]);
  function render(schema: InferredSchema, hint: string): string {
    if (schema.anyOf) return schema.anyOf.map((s, i) => render(s, `${hint}${i + 1}`)).join(' | ');
    if (schema.type === 'array') return `(${render(schema.items ?? {}, hint + 'Item')})[]`;
    if (schema.type === 'object') {
      let typeName = hint.replace(/[^A-Za-z0-9_$]/g, '_');
      if (!/^[A-Za-z_$]/.test(typeName) || reserved.has(typeName)) typeName = 'Node_' + typeName;
      const base = typeName;
      let i = 2;
      while (used.has(typeName)) typeName = base + i++;
      used.add(typeName);
      declare(schema, typeName);
      return typeName;
    }
    return schema.type === 'null' ? 'null' : (schema.type ?? 'unknown');
  }
  function declare(schema: InferredSchema, typeName: string) {
    const fields = Object.entries(schema.properties ?? {})
      .map(
        ([key, s]) =>
          `  ${JSON.stringify(key)}${schema.required?.includes(key) ? '' : '?'}: ${render(s, typeName + '_' + key)};`,
      )
      .join('\n');
    declarations.push(
      `${exported ? 'export ' : ''}${alias ? 'type' : 'interface'} ${typeName}${alias ? ' =' : ''} {\n${fields}\n}${alias ? ';' : ''}`,
    );
  }
  const root = inferSchema([value]);
  if (root.type === 'object') declare(root, name);
  else
    declarations.push(
      `${exported ? 'export ' : ''}type ${name} = ${render(root, name + 'Value')};`,
    );
  return '// 샘플 기반 추론 초안: 실제 API 계약을 검토하세요.\n' + declarations.join('\n\n');
}
