import { Parser, type Language, type Node } from 'web-tree-sitter';
import { languageAdapters } from './adapters';
export const syntaxLanguages = ['java', 'csharp', 'python', 'javascript', 'typescript'] as const;
export type SyntaxLanguage = (typeof syntaxLanguages)[number];
export interface SymbolInfo {
  kind: 'class' | 'function' | 'import';
  name: string;
  scope: string;
  line: number;
  endLine: number;
  signature: string;
  parameters: string;
  body: string;
}
export interface SyntaxChange {
  type: 'added' | 'removed' | 'changed' | 'rename-candidate';
  before?: SymbolInfo;
  after?: SymbolInfo;
  details: string[];
}
export interface SyntaxResult {
  changes: SyntaxChange[];
  beforeCount: number;
  afterCount: number;
}
export const MAX_SYNTAX_BYTES = 1024 * 1024;
export function validateSource(source: string) {
  if (new TextEncoder().encode(source).length > MAX_SYNTAX_BYTES)
    throw new Error('구문 비교는 파일당 1 MiB까지 지원합니다. Text Diff를 사용하세요.');
}
function fingerprint(node: Node | null, skipBody = false): string {
  if (!node) return '';
  const tokens: string[] = [];
  const stack = [node];
  while (stack.length) {
    const current = stack.pop()!;
    if (
      current.type.includes('comment') ||
      (skipBody && current.id === node.childForFieldName('body')?.id)
    )
      continue;
    if (!current.childCount) tokens.push(JSON.stringify([current.type, current.text]));
    else for (let i = current.childCount - 1; i >= 0; i--) stack.push(current.child(i)!);
  }
  return tokens.join('');
}
function lineLookup(source: string) {
  const starts = [0];
  const eol = /\r\n|\r|\n/g;
  let match: RegExpExecArray | null;
  while ((match = eol.exec(source))) starts.push(match.index + match[0].length);
  return (offset: number) => {
    let low = 0,
      high = starts.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (starts[middle] <= offset) low = middle;
      else high = middle;
    }
    return low + 1;
  };
}
export function extractSymbols(
  source: string,
  language: Language,
  adapter?: SyntaxLanguage,
): SymbolInfo[] {
  const definitions = adapter
    ? languageAdapters[adapter]
    : {
        classes: Object.values(languageAdapters).flatMap((a) => a.classes),
        functions: Object.values(languageAdapters).flatMap((a) => a.functions),
        imports: Object.values(languageAdapters).flatMap((a) => a.imports),
      };
  const classes = new Set(definitions.classes),
    functions = new Set(definitions.functions),
    imports = new Set(definitions.imports);
  validateSource(source);
  const physicalLine = lineLookup(source);
  const parser = new Parser();
  let tree: ReturnType<Parser['parse']> = null;
  try {
    parser.setLanguage(language);
    const started = performance.now();
    // Older grammars terminate line comments at LF only. Replace lone CR in a
    // parse-only copy: UTF-16 offsets stay identical to the untouched raw text.
    tree = parser.parse(source.replace(/\r(?!\n)/g, '\n'), null, {
      progressCallback: () => performance.now() - started > 1000,
    });
    if (!tree) throw new Error('구문 분석 시간 제한을 초과했습니다.');
    if (tree.rootNode.hasError)
      throw new Error(
        '구문 오류가 있어 AST 결과를 제공하지 않습니다. Text Diff에서 원문을 확인하세요.',
      );
    const pending = [{ node: tree.rootNode, depth: 0 }];
    let count = 0;
    while (pending.length) {
      const item = pending.pop()!;
      if (++count > 100_000 || item.depth > 128)
        throw new Error('구문 트리 크기·깊이 제한을 초과했습니다.');
      for (let i = 0; i < item.node.childCount; i++)
        pending.push({ node: item.node.child(i)!, depth: item.depth + 1 });
    }
    const symbols: SymbolInfo[] = [];
    const packageNode = tree.rootNode.namedChildren.find((n) => n?.type === 'package_declaration');
    const packageScope = packageNode ? `/package:${fingerprint(packageNode)}` : '';
    const stack: { node: Node; scope: string }[] = [{ node: tree.rootNode, scope: packageScope }];
    let visited = 0;
    while (stack.length) {
      if (++visited > 100_000 || symbols.length > 5000)
        throw new Error('구문 요소 제한을 초과했습니다. Text Diff를 사용하세요.');
      const { node, scope } = stack.pop()!;
      const kind = classes.has(node.type)
        ? 'class'
        : functions.has(node.type)
          ? 'function'
          : imports.has(node.type)
            ? 'import'
            : undefined;
      const name =
        node.childForFieldName('name')?.text ?? (kind === 'import' ? fingerprint(node) : '');
      if (kind && name && symbols.length >= 5000)
        throw new Error('구문 요소 제한을 초과했습니다. Text Diff를 사용하세요.');
      if (kind && name)
        symbols.push({
          kind,
          name: kind === 'import' ? node.text : name,
          scope,
          line: physicalLine(node.startIndex),
          endLine: physicalLine(Math.max(node.startIndex, node.endIndex - 1)),
          signature: fingerprint(node, true),
          parameters: fingerprint(node.childForFieldName('parameters')),
          body: fingerprint(node.childForFieldName('body')),
        });
      const namespace =
        node.type === 'namespace_declaration' ||
        node.type === 'file_scoped_namespace_declaration' ||
        node.type === 'internal_module';
      const childScope =
        namespace && name
          ? `${scope}/namespace:${name}`
          : kind && kind !== 'import' && name
            ? `${scope}/${kind}:${name}`
            : scope;
      for (let i = node.namedChildCount - 1; i >= 0; i--)
        stack.push({ node: node.namedChild(i)!, scope: childScope });
    }
    return symbols;
  } finally {
    tree?.delete();
    parser.delete();
  }
}
export function matchSymbols(before: SymbolInfo[], after: SymbolInfo[]): SyntaxResult {
  const identity = (symbol: SymbolInfo) =>
    symbol.kind === 'import' ? symbol.signature : symbol.name;
  const remaining = new Set(after);
  const unmatched: SymbolInfo[] = [];
  const changes: SyntaxChange[] = [];
  for (const old of before) {
    const candidates = [...remaining].filter(
      (n) => n.kind === old.kind && n.scope === old.scope && identity(n) === identity(old),
    );
    const exact = candidates.filter((n) => n.parameters === old.parameters);
    // Ambiguous overloads are deliberately left unmatched.
    const next =
      exact.length === 1 &&
      before.filter(
        (n) =>
          n.kind === old.kind &&
          n.scope === old.scope &&
          n.name === old.name &&
          n.parameters === old.parameters,
      ).length === 1
        ? exact[0]
        : candidates.length === 1 &&
            before.filter(
              (n) => n.kind === old.kind && n.scope === old.scope && n.name === old.name,
            ).length === 1
          ? candidates[0]
          : undefined;
    if (!next) {
      unmatched.push(old);
      continue;
    }
    remaining.delete(next);
    const details: string[] = [];
    if (old.parameters !== next.parameters) details.push('매개변수 변경');
    if (old.signature !== next.signature) details.push('선언 변경');
    if (old.body !== next.body) details.push('코드 블록 변경');
    if (details.length) changes.push({ type: 'changed', before: old, after: next, details });
  }
  const renameCompatible = (a: SymbolInfo, b: SymbolInfo) =>
    a.kind === 'function' &&
    b.kind === a.kind &&
    b.scope === a.scope &&
    b.parameters === a.parameters &&
    b.body === a.body &&
    !!a.body &&
    a.name !== b.name;
  for (const old of unmatched) {
    const candidates = [...remaining].filter((n) => renameCompatible(old, n));
    const next =
      candidates.length === 1 &&
      unmatched.filter((n) => renameCompatible(n, candidates[0])).length === 1
        ? candidates[0]
        : undefined;
    if (next) {
      remaining.delete(next);
      changes.push({
        type: 'rename-candidate',
        before: old,
        after: next,
        details: ['동일 매개변수·본문 기반 이름 변경 후보 (확정 아님)'],
      });
    } else changes.push({ type: 'removed', before: old, details: [] });
  }
  for (const next of remaining) changes.push({ type: 'added', after: next, details: [] });
  return { changes, beforeCount: before.length, afterCount: after.length };
}
export function compareSyntax(
  before: string,
  after: string,
  language: Language,
  adapter?: SyntaxLanguage,
): SyntaxResult {
  return matchSymbols(
    extractSymbols(before, language, adapter),
    extractSymbols(after, language, adapter),
  );
}
