import { usePreferences } from '../stores/preferences';
import { useEffect, useState, useSyncExternalStore } from 'react';
import * as monaco from 'monaco-editor';
import { computeWorkerCount, subscribeComputeWorkers } from '../workers/client';
export function DisplaySettings() {
  const state = usePreferences();
  const workers = useSyncExternalStore(subscribeComputeWorkers, computeWorkerCount);
  const [models, setModels] = useState(0);
  useEffect(() => {
    let active = true;
    const update = () =>
      queueMicrotask(() => {
        if (active) setModels(monaco.editor.getModels().length);
      });
    const created = monaco.editor.onDidCreateModel(update),
      disposed = monaco.editor.onWillDisposeModel(update);
    update();
    return () => {
      active = false;
      created.dispose();
      disposed.dispose();
    };
  }, []);
  return (
    <details className="display-settings">
      <summary>화면 설정</summary>
      <div className="display-controls">
        <small>좁은 화면에서는 MiniMap을 숨깁니다. 설정은 현재 세션에만 유지됩니다.</small>
        <output aria-label="로컬 처리 현황">
          편집 모델 {models}개 · 계산 Worker {workers}개
        </output>
        <label>
          테마{' '}
          <select
            aria-label="테마"
            value={state.theme}
            onChange={(e) => state.set({ theme: e.target.value as 'dark' | 'light' })}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.minimap}
            onChange={(e) => state.set({ minimap: e.target.checked })}
          />{' '}
          MiniMap
        </label>
        <label>
          분석 패널 너비 {state.analysisWidth}px
          <input
            aria-label="분석 패널 너비"
            type="range"
            min="240"
            max="480"
            step="10"
            value={state.analysisWidth}
            onChange={(e) => state.set({ analysisWidth: Number(e.target.value) })}
          />
        </label>
        <label>
          데이터 원본 패널 비율 {state.sourceRatio}%
          <input
            aria-label="데이터 원본 패널 비율"
            type="range"
            min="30"
            max="60"
            value={state.sourceRatio}
            onChange={(e) => state.set({ sourceRatio: Number(e.target.value) })}
          />
        </label>
        <label>
          편집기 높이 {state.editorHeight}px
          <input
            aria-label="편집기 높이"
            type="range"
            min="400"
            max="900"
            step="50"
            value={state.editorHeight}
            onChange={(e) => state.set({ editorHeight: Number(e.target.value) })}
          />
        </label>
        <button
          onClick={() => state.set({ analysisWidth: 280, sourceRatio: 45, editorHeight: 600 })}
        >
          패널 크기 초기화
        </button>
      </div>
    </details>
  );
}
