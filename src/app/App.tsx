import * as monaco from 'monaco-editor';
import { usePreferences } from '../stores/preferences';
import { AppShell, type WorkspaceId } from '../components/AppShell';
import { WorkspaceActive } from '../hooks/useCompute';
import { lazy, Suspense, useLayoutEffect, useState, type ReactNode } from 'react';
import CodeCompare from './CodeCompare';
const JsonWorkspace = lazy(() => import('../features/json-tools/JsonWorkspace'));
const MappingWorkspace = lazy(() => import('../features/field-mapping/MappingWorkspace'));
const PatchExport = lazy(() => import('../features/patch-export/PatchExport'));
const SyntaxWorkspace = lazy(() => import('../features/syntax-compare/SyntaxWorkspace'));
const FolderCompare = lazy(() => import('../features/folder-compare/FolderCompare'));
function Panel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <WorkspaceActive.Provider value={active}>
      <div hidden={!active} id={active ? 'active-workspace' : undefined} tabIndex={-1}>
        {children}
      </div>
    </WorkspaceActive.Provider>
  );
}
export default function App() {
  const prefs = usePreferences();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.style.setProperty('--analysis-width', `${prefs.analysisWidth}px`);
    root.style.setProperty('--source-track', `${prefs.sourceRatio}fr`);
    root.style.setProperty('--target-track', `${100 - prefs.sourceRatio}fr`);
    root.style.setProperty('--mapping-rest', `${(100 - prefs.sourceRatio) / 2}fr`);
    root.style.setProperty('--editor-height', `${prefs.editorHeight}px`);
    monaco.editor.setTheme(prefs.theme === 'dark' ? 'vs-dark' : 'vs');
  }, [prefs]);
  const [codeVersion, setCodeVersion] = useState(0);
  const [workspace, setWorkspace] = useState<WorkspaceId>('code');
  const [opened, setOpened] = useState<Partial<Record<WorkspaceId, boolean>>>({ code: true });
  function openWorkspace(next: WorkspaceId) {
    setOpened((previous) => ({ ...previous, [next]: true }));
    setWorkspace(next);
  }
  return (
    <AppShell workspace={workspace} onSelect={openWorkspace}>
      <Panel active={workspace === 'code'}>
        <CodeCompare key={codeVersion} />
      </Panel>
      {opened.json && (
        <Panel active={workspace === 'json'}>
          <Suspense fallback={<p className="loading">JSON 도구를 준비하고 있습니다…</p>}>
            <JsonWorkspace />
          </Suspense>
        </Panel>
      )}
      {opened.mapping && (
        <Panel active={workspace === 'mapping'}>
          <Suspense fallback={<p className="loading">필드 매핑을 준비하고 있습니다…</p>}>
            <MappingWorkspace />
          </Suspense>
        </Panel>
      )}
      {opened.patch && (
        <Panel active={workspace === 'patch'}>
          <Suspense fallback={<p className="loading">Patch 도구를 준비하고 있습니다…</p>}>
            <PatchExport onCompare={() => setWorkspace('code')} />
          </Suspense>
        </Panel>
      )}
      {opened.syntax && (
        <Panel active={workspace === 'syntax'}>
          <Suspense fallback={<p>구문 도구 준비 중…</p>}>
            <SyntaxWorkspace />
          </Suspense>
        </Panel>
      )}
      {opened.folder && (
        <Panel active={workspace === 'folder'}>
          <Suspense fallback={<p className="loading">폴더 비교를 준비하고 있습니다…</p>}>
            <FolderCompare
              onCompare={() => {
                setCodeVersion((v) => v + 1);
                setWorkspace('code');
              }}
            />
          </Suspense>
        </Panel>
      )}
    </AppShell>
  );
}
