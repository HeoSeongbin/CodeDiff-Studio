import { lazy, Suspense, useState } from 'react';
import CodeCompare from './CodeCompare';
const JsonWorkspace = lazy(() => import('../features/json-tools/JsonWorkspace'));
const MappingWorkspace = lazy(() => import('../features/field-mapping/MappingWorkspace'));
export default function App() {
  const [workspace, setWorkspace] = useState('code'),
    [jsonOpened, setJsonOpened] = useState(false),
    [mappingOpened, setMappingOpened] = useState(false);
  function openJson() {
    setJsonOpened(true);
    setWorkspace('json');
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
        <span>로컬 처리 · Phase 4</span>
      </nav>
      <div hidden={workspace !== 'code'}>
        <CodeCompare onJson={openJson} />
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
    </>
  );
}
