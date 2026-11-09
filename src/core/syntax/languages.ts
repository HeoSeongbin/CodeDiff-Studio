export const syntaxLanguages = ['java', 'csharp', 'python', 'javascript', 'typescript'] as const;
export type SyntaxLanguage = (typeof syntaxLanguages)[number];
