// The shell: brand, navigation, the current section, toasts and the undo bar.
import { useEffect } from 'preact/hooks';
import { route, navigate, VIEWS } from './router.js';
import { ready, db, saveState, saveError, canUndo, undoLabel, undo, lastChange, notice } from '../store/store.js';
import { Icon, BrandMark } from '../ui/components/Icon.jsx';
import { ToastHost, toast } from '../ui/components/Toast.jsx';
import { ModalHost } from '../ui/components/Modal.jsx';
import { Home } from '../ui/views/Home.jsx';
import { Calendar } from '../ui/views/Calendar.jsx';
import { Carers } from '../ui/views/Carers.jsx';
import { Holidays } from '../ui/views/Holidays.jsx';
import { Reports } from '../ui/views/Reports.jsx';
import { Settings } from '../ui/views/Settings.jsx';
import { Onboarding } from '../ui/views/Onboarding.jsx';

const VIEW_COMPONENTS = { home: Home, calendar: Calendar, carers: Carers, holidays: Holidays, reports: Reports, settings: Settings };

function NavItems({ compact = false }) {
  const current = route.value.view;
  return VIEWS.map((v) => (
    <button
      key={v.id}
      type="button"
      class={`nav-item ${current === v.id ? 'active' : ''}`}
      onClick={() => navigate(v.id)}
      aria-current={current === v.id ? 'page' : undefined}
      title={compact ? v.label : v.hint}
      data-nav={v.id}
    >
      <Icon name={v.icon} />
      <span>{v.label}</span>
    </button>
  ));
}

function SaveIndicator() {
  const s = saveState.value;
  const label = s === 'saving' ? 'Saving…' : s === 'error' ? 'Not saved' : 'All changes saved';
  return (
    <span class={`save-indicator ${s}`} title={s === 'error' ? saveError.value || 'Could not save' : label}>
      <span class="dot" /> {label}
    </span>
  );
}

function Sidebar() {
  const s = db.value?.settings;
  return (
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><BrandMark /></div>
        <div>
          <div class="brand-name">{s?.companyName || 'Monteith Personal Care'}</div>
          <div class="brand-sub">{s?.appName || 'Holiday Manager'}</div>
        </div>
      </div>
      <nav class="nav" aria-label="Main sections"><NavItems /></nav>
      <div class="sidebar-foot">
        <SaveIndicator />
        <span class="muted">Version {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</span>
      </div>
    </aside>
  );
}

function UndoBar() {
  // Show a small undo prompt after each change, for a few seconds.
  const change = lastChange.value;
  if (!change || !canUndo.value) return null;
  return <UndoToast key={change.at} label={change.label} />;
}

function NoticeToast() {
  const n = notice.value;
  useEffect(() => { if (n) toast.info(n.message); }, [n?.at]);
  return null;
}

function UndoToast({ label }) {
  useEffect(() => {
    const id = toast(label, {
      kind: 'info',
      action: { label: 'Undo', onClick: () => { undo(); } },
      duration: 6000,
    });
    return () => toast.dismiss(id);
  }, [label]);
  return null;
}

export function App() {
  const isReady = ready.value;
  const doc = db.value;
  useEffect(() => {
    if (doc?.settings) document.title = `${doc.settings.companyName} · ${doc.settings.appName}`;
  }, [doc?.settings?.companyName, doc?.settings?.appName]);

  if (!isReady || !doc) {
    return <div class="loading-screen"><div class="brand-mark"><BrandMark /></div><p>Opening your holiday manager…</p></div>;
  }

  if (!doc.settings.onboardingComplete) {
    return (
      <div class="app app-onboarding">
        <Onboarding />
        <ToastHost />
        <ModalHost />
      </div>
    );
  }

  const View = VIEW_COMPONENTS[route.value.view] || Home;
  return (
    <div class="app">
      <Sidebar />
      <main class="main" id="main">
        <View params={route.value.params} />
      </main>
      <nav class="bottom-nav" aria-label="Main sections"><NavItems compact /></nav>
      <ToastHost />
      <ModalHost />
      <UndoBar />
      <NoticeToast />
    </div>
  );
}
