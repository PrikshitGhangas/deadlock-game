import { useEffect, useState } from 'react';
import TopBar, { TABS } from './components/layout/TopBar.jsx';
import SimulatorPage from './pages/SimulatorPage.jsx';
import BankersPage from './pages/BankersPage.jsx';
import LabPage from './pages/LabPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import TheoryPage from './pages/TheoryPage.jsx';
import DevelopedByPage from './pages/DevelopedByPage.jsx';
import InnovationPage from './pages/InnovationPage.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useToast } from './hooks/useToast.js';

const VALID = new Set(TABS.map((t) => t.id));
const fromHash = () => { const h = window.location.hash.replace('#', ''); return VALID.has(h) ? h : 'detection'; };

export default function App() {
  const [tab, setTab] = useState(fromHash);
  const { theme, toggle } = useTheme();
  const { toastMsg, toast } = useToast();
  /** { mode, input, title } — a run to reopen, set by History */
  const [loadRequest, setLoadRequest] = useState(null);

  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (id) => { window.location.hash = id; setTab(id); };

  const openRun = (run) => {
    setLoadRequest({ mode: run.mode, input: run.input, title: run.title });
    go(run.mode);
  };
  const consume = (mode) => (loadRequest && loadRequest.mode === mode ? loadRequest : null);

  return (
    <div className="app">
      <TopBar tab={tab} onTab={go} theme={theme} onTheme={toggle} />
      {/* Simulator pages stay mounted so switching tabs keeps their state */}
      <div hidden={tab !== 'detection'}><SimulatorPage mode="detection" active={tab === 'detection'} theme={theme} toast={toast} loadRequest={consume('detection')} onLoaded={() => setLoadRequest(null)} /></div>
      <div hidden={tab !== 'prevention'}><SimulatorPage mode="prevention" active={tab === 'prevention'} theme={theme} toast={toast} loadRequest={consume('prevention')} onLoaded={() => setLoadRequest(null)} /></div>
      <div hidden={tab !== 'bankers'}><BankersPage active={tab === 'bankers'} toast={toast} loadRequest={consume('bankers')} onLoaded={() => setLoadRequest(null)} /></div>
      <div hidden={tab !== 'lab'}><LabPage toast={toast} /></div>
      {tab === 'history' && <HistoryPage onLoad={openRun} toast={toast} />}
      {tab === 'theory' && <TheoryPage onTab={go} />}
      {tab === 'innovation' && <InnovationPage onTab={go} />}
      {tab === 'about' && <DevelopedByPage />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
