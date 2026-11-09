import { lazy, Suspense, useState } from 'react';
import CodeCompare from './CodeCompare';
const JsonWorkspace = lazy(() => import('../features/json-tools/JsonWorkspace'));
const MappingWorkspace = lazy(() => import('../features/field-mapping/MappingWorkspace'));
const PatchExport = lazy(() => import('../features/patch-export/PatchExport'));
const SyntaxWorkspace = lazy(() => import('../features/syntax-compare/SyntaxWorkspace'));
const FolderCompare = lazy(() => import('../features/folder-compare/FolderCompare'));
export default function App() {
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
        <span>로컬 처리 · Phase 7</span>
      </nav>
      <div hidden={workspace !== 'code'}>
        <CodeCompare key={codeVersion} onJson={openJson} onFolder={openFolder} />
      </div>
      {jsonOpened && (
        <div hidden={workspace !== 'json'}>
          <Suspense fallback={<p className="loading">JSON 도구를 준비하고 있습니다…</p>}>
            <JsonWorkspace />
          </Suspense>
        </div>
      )}
      {mappingOpened && (
        <div hidden={workspace !== 'mapping'}>
          <Suspense fallback={<p className="loading">필드 매핑을 준비하고 있습니다…</p>}>
            <MappingWorkspace />
          </Suspense>
        </div>
      )}
      {patchOpened && (
        <div hidden={workspace !== 'patch'}>
          <Suspense fallback={<p className="loading">Patch 도구를 준비하고 있습니다…</p>}>
            <PatchExport onCompare={() => setWorkspace('code')} />
          </Suspense>
        </div>
      )}
      {syntaxOpened && (
        <div hidden={workspace !== 'syntax'}>
          <Suspense fallback={<p>구문 도구 준비 중…</p>}>
            <SyntaxWorkspace />
          </Suspense>
        </div>
      )}
      {folderOpened && (
        <div hidden={workspace !== 'folder'}>
          <Suspense fallback={<p className="loading">폴더 비교를 준비하고 있습니다…</p>}>
            <FolderCompare
              onCompare={() => {
                setCodeVersion((v) => v + 1);
                setWorkspace('code');
              }}
            />
          </Suspense>
        </div>
      )}
    </>
  );
}
