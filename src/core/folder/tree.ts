import type { FolderRow } from './engine';
export interface FolderTreeRow {
  path: string;
  depth: number;
  directory: boolean;
  file?: FolderRow;
  count: number;
}
interface Node {
  path: string;
  children: Map<string, Node>;
  file?: FolderRow;
  count: number;
}
export function folderTree(
  files: FolderRow[],
  collapsed: ReadonlySet<string> = new Set(),
): FolderTreeRow[] {
  const root: Node = { path: '', children: new Map(), count: 0 };
  for (const file of files) {
    let current = root;
    const parts = file.path.split('/');
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      let child = current.children.get(part);
      if (!child) {
        child = { path, children: new Map(), count: 0 };
        current.children.set(part, child);
      }
      child.count++;
      current = child;
      if (i === parts.length - 1) current.file = file;
    });
  }
  const rows: FolderTreeRow[] = [];
  function visit(node: Node, depth: number) {
    const sorted = [...node.children.values()].sort(
      (a, b) =>
        Number(!a.children.size) - Number(!b.children.size) ||
        (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
    );
    for (const child of sorted) {
      if (child.children.size) {
        rows.push({
          path: child.path,
          depth,
          directory: true,
          count: child.count - (child.file ? 1 : 0),
        });
        if (!collapsed.has(child.path)) visit(child, depth + 1);
      }
      if (child.file)
        rows.push({ path: child.path, depth, directory: false, file: child.file, count: 1 });
    }
  }
  visit(root, 0);
  return rows;
}
