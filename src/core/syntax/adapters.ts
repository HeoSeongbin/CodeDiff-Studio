import type { SyntaxLanguage } from './compare';
// Grammar node names are adapter data; matching never depends on a language's AST API.
export const languageAdapters: Record<
  SyntaxLanguage,
  { classes: string[]; functions: string[]; imports: string[] }
> = {
  java: {
    classes: [
      'class_declaration',
      'interface_declaration',
      'enum_declaration',
      'record_declaration',
    ],
    functions: ['method_declaration', 'constructor_declaration'],
    imports: ['import_declaration'],
  },
  csharp: {
    classes: [
      'class_declaration',
      'interface_declaration',
      'struct_declaration',
      'record_declaration',
      'enum_declaration',
    ],
    functions: ['method_declaration', 'constructor_declaration', 'local_function_statement'],
    imports: ['using_directive'],
  },
  python: {
    classes: ['class_definition'],
    functions: ['function_definition'],
    imports: ['import_statement', 'import_from_statement'],
  },
  javascript: {
    classes: ['class_declaration'],
    functions: ['function_declaration', 'generator_function_declaration', 'method_definition'],
    imports: ['import_statement'],
  },
  typescript: {
    classes: ['class_declaration', 'interface_declaration'],
    functions: ['function_declaration', 'generator_function_declaration', 'method_definition'],
    imports: ['import_statement'],
  },
};
