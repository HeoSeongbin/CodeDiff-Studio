import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Braces,
  Files,
  FileDiff,
  GitCompareArrows,
  Menu,
  Network,
  ShieldCheck,
  SquareCode,
  X,
} from 'lucide-react';
import { DisplaySettings } from './DisplaySettings';

const workspaces = [
  { id: 'code', name: 'Code Compare', icon: GitCompareArrows },
  { id: 'folder', name: 'Folder Compare', icon: Files },
  { id: 'json', name: 'JSON Tools', icon: Braces },
  { id: 'mapping', name: 'Field Mapping', icon: Network },
  { id: 'patch', name: 'Patch Export', icon: FileDiff },
  { id: 'syntax', name: 'Syntax Compare', icon: SquareCode },
] as const;
export type WorkspaceId = (typeof workspaces)[number]['id'];

export function AppShell({
  workspace,
  onSelect,
  children,
}: {
  workspace: WorkspaceId;
  onSelect: (workspace: WorkspaceId) => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const topbar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const update = () =>
      frame.current?.style.setProperty(
        '--app-topbar-height',
        `${topbar.current?.getBoundingClientRect().height ?? 78}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(topbar.current!);
    update();
    return () => observer.disconnect();
  }, []);
  return (
    <div className="app-frame" ref={frame}>
      <a className="skip-link" href="#active-workspace">
        본문으로 이동
      </a>
      <div
        className="app-topbar"
        ref={topbar}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && menuOpen) {
            event.stopPropagation();
            setMenuOpen(false);
            toggle.current?.focus();
          }
        }}
      >
        <nav
          id="workspace-menu"
          className="workspace-nav"
          aria-label="워크스페이스 메뉴"
          hidden={!menuOpen}
        >
          {workspaces.map((item) => (
            <button
              key={item.id}
              aria-label={`${item.name} 탭`}
              aria-pressed={workspace === item.id}
              onClick={() => onSelect(item.id)}
            >
              {item.name}
            </button>
          ))}
          <DisplaySettings />
        </nav>
        <header className="app-header">
          <div className="brand">
            <span className="logo">
              <GitCompareArrows size={22} />
            </span>
            <div>
              CodeDiff <strong>Studio</strong>
              <small>CODE COMPARISON WORKSPACE</small>
            </div>
          </div>
          <div className="privacy">
            <ShieldCheck size={15} /> 브라우저 로컬 처리
          </div>
          <button
            ref={toggle}
            className="workspace-menu-toggle"
            aria-label="워크스페이스 메뉴"
            aria-expanded={menuOpen}
            aria-controls="workspace-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
            <span>{menuOpen ? '메뉴 닫기' : '메뉴'}</span>
          </button>
        </header>
      </div>
      <div className="app-body">
        <nav className="rail app-rail" aria-label="작업 공간 바로가기">
          {workspaces.map((item) => (
            <button
              key={item.id}
              aria-label={item.name}
              title={item.name}
              aria-pressed={workspace === item.id}
              className={workspace === item.id ? 'rail-active' : undefined}
              onClick={() => onSelect(item.id)}
            >
              <item.icon size={21} />
            </button>
          ))}
          <div className="rail-bottom" aria-hidden="true">
            CD
          </div>
        </nav>
        <div className="workspace-content">{children}</div>
      </div>
    </div>
  );
}
