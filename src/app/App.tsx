import * as monaco from 'monaco-editor';
import { usePreferences } from '../stores/preferences';
import { DisplaySettings } from '../components/DisplaySettings';
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
  const [workspace, setWorkspace] = useState('code'),
    [jsonOpened, setJsonOpened] = useState(false),
    [mappingOpened, setMappingOpened] = useState(false),
    [patchOpened, setPatchOpened] = useState(false),
    [folderOpened, setFolderOpened] = useState(false),
    [syntaxOpened, setSyntaxOpened] = useState(false);
  function openJson() {
    setJsonOpened(true);
    setWorkspace('json');
  }
  function openFolder() {
    setFolderOpened(true);
    setWorkspace('folder');
  }
  return (
    <>
      <a className="skip-link" href="#active-workspace">
        본문으로 이동
      </a>
      <nav className="workspace-nav" aria-label="워크스페이스">
        <button aria-pressed={workspace === 'code'} onClick={() => setWorkspace('code')}>
          Code Compare
        </button>
        <button aria-pressed={workspace === 'json'} onClick={openJson}>
          JSON Tools
        </button>
        <button
          aria-pressed={workspace === 'mapping'}
          onClick={() => {
            setMappingOpened(true);
            setWorkspace('mapping');
          }}
        >
          Field Mapping
        </button>
        <button
          aria-pressed={workspace === 'patch'}
          onClick={() => {
            setPatchOpened(true);
            setWorkspace('patch');
          }}
        >
          Patch Export
        </button>
        <button aria-pressed={workspace === 'folder'} onClick={openFolder}>
          Folder Compare
        </button>
        <button
          aria-pressed={workspace === 'syntax'}
          onClick={() => {
            setSyntaxOpened(true);
            setWorkspace('syntax');
          }}
        >
          Syntax Compare
        </button>
        <DisplaySettings />
        <span>로컬 처리 · Phase 8</span>
      </nav>
      <Panel active={workspace === 'code'}>
        <CodeCompare key={codeVersion} onJson={openJson} onFolder={openFolder} />
      </Panel>
      {jsonOpened && (
        <Panel active={workspace === 'json'}>
          <Suspense fallback={<p className="loading">JSON 도구를 준비하고 있습니다…</p>}>
            <JsonWorkspace />
          </Suspense>
        </Panel>
      )}
      {mappingOpened && (
        <Panel active={workspace === 'mapping'}>
          <Suspense fallback={<p className="loading">필드 매핑을 준비하고 있습니다…</p>}>
            <MappingWorkspace />
          </Suspense>
        </Panel>
      )}
      {patchOpened && (
        <Panel active={workspace === 'patch'}>
          <Suspense fallback={<p className="loading">Patch 도구를 준비하고 있습니다…</p>}>
            <PatchExport onCompare={() => setWorkspace('code')} />
          </Suspense>
        </Panel>
      )}
      {syntaxOpened && (
        <Panel active={workspace === 'syntax'}>
          <Suspense fallback={<p>구문 도구 준비 중…</p>}>
            <SyntaxWorkspace />
          </Suspense>
        </Panel>
      )}
      {folderOpened && (
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
    </>
  );
}
