import { Language, Parser } from 'web-tree-sitter';
import runtime from 'web-tree-sitter/tree-sitter.wasm?url';
import java from 'tree-sitter-wasms/out/tree-sitter-java.wasm?url';
import csharp from 'tree-sitter-wasms/out/tree-sitter-c_sharp.wasm?url';
import python from 'tree-sitter-wasms/out/tree-sitter-python.wasm?url';
import javascript from 'tree-sitter-wasms/out/tree-sitter-javascript.wasm?url';
import typescript from 'tree-sitter-wasms/out/tree-sitter-typescript.wasm?url';
import type { SyntaxLanguage } from './compare';
const assets = { java, csharp, python, javascript, typescript };
let initialized: Promise<void> | undefined;
const cache = new Map<SyntaxLanguage, Promise<Language>>();
export async function loadSyntaxLanguage(name: SyntaxLanguage): Promise<Language> {
  initialized ??= Parser.init({ locateFile: () => runtime }).catch((error) => {
    initialized = undefined;
    throw error;
  });
  await initialized;
  let loaded = cache.get(name);
  if (!loaded) {
    loaded = Language.load(assets[name]).catch((error) => {
      cache.delete(name);
      throw error;
    });
    cache.set(name, loaded);
  }
  return loaded;
}
