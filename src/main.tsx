import React from 'react';
import ReactDOM from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import App from './app/App';
import './style.css';
self.MonacoEnvironment = {
  getWorker: (_id, label) =>
    label === 'json'
      ? new JsonWorker()
      : ['css', 'scss', 'less'].includes(label)
        ? new CssWorker()
        : ['html', 'handlebars', 'razor'].includes(label)
          ? new HtmlWorker()
          : ['typescript', 'javascript'].includes(label)
            ? new TsWorker()
            : new EditorWorker(),
};
// Keep JSON diagnostics local, even for documents containing a remote $schema URL.
monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: false,
  enableSchemaRequest: false,
  schemas: [],
});
loader.config({ monaco });
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
