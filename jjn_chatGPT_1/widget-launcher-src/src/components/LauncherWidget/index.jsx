import React, { useState, useEffect } from 'react';
import { ROWS } from '../../constants/rows';
import CardHeader from './CardHeader';
import AnalysisRow from './AnalysisRow';
import SettingsSection from './SettingsSection';

/* ChatGPT Apps SDK 분기
   로컬 shell: window.parent.postMessage({ type:'resize', height })
   공식 SDK:   window.openai?.notifyIntrinsicHeight(height) — 존재 시 우선 */
function notifyHeight(h) {
  if (window.openai?.notifyIntrinsicHeight) {
    window.openai.notifyIntrinsicHeight(h);
  } else {
    try { window.parent.postMessage({ type:'resize', height: h }, '*'); } catch (_) {}
  }
}

export default function LauncherWidget() {
  const [activeRow,  setActiveRow]  = useState(null);
  const [rowTexts,   setRowTexts]   = useState({});
  const [rowModes,   setRowModes]   = useState({});
  const [settOpen,   setSettOpen]   = useState(false);
  // 기본값 변경 시 이 세 줄만 수정
  const [risk,       setRisk]       = useState(2);   // 0:매우보수적 1:보수적 2:중간 3:공격적 4:매우공격적
  const [stylePref,  setStylePref]  = useState(1);   // 0:밸류에이션 1:균형 2:성장
  const [period,     setPeriod]     = useState(1);   // 0:단기 1:중기 2:장기
  const [method,     setMethod]     = useState('report'); // null or 'report'|'style'|'valuation'|'news'

  /* ResizeObserver로 높이 보고 */
  useEffect(() => {
    const report = () => notifyHeight(document.documentElement.scrollHeight);
    const ro = new ResizeObserver(report);
    ro.observe(document.body);
    report();
    return () => ro.disconnect();
  }, []);

  function toggle(id) {
    setActiveRow(prev => prev === id ? null : id);
  }

  function send(id) {
    const q = (rowTexts[id] || '').trim();
    if (!q) return;
    try {
      window.parent.postMessage({
        type: 'launcher-submit',
        analysisType: id,
        query: q,
        mode: rowModes[id] || 'normal',
        settings: { risk, stylePref, period, method },
      }, '*');
    } catch (_) {}
  }

  return (
    <div style={{ background:'#fff', border:'0.5px solid rgba(13,13,13,.15)', borderRadius:24, overflow:'hidden', width:'100%' }}>
      <div style={{ display:'flex', flexDirection:'column' }}>
        <CardHeader />
        {ROWS.map(row => (
          <AnalysisRow
            key={row.id}
            {...row}
            isActive={activeRow === row.id}
            onToggle={() => toggle(row.id)}
            text={rowTexts[row.id] || ''}
            onTextChange={t => setRowTexts(prev => ({ ...prev, [row.id]: t }))}
            mode={rowModes[row.id] || 'normal'}
            onModeChange={m => setRowModes(prev => ({ ...prev, [row.id]: m }))}
            onSend={() => send(row.id)}
          />
        ))}
        <SettingsSection
          open={settOpen}       onToggle={() => setSettOpen(o => !o)}
          risk={risk}           onRisk={setRisk}
          stylePref={stylePref} onStylePref={setStylePref}
          period={period}       onPeriod={setPeriod}
          method={method}       onMethod={setMethod}
        />
      </div>
    </div>
  );
}
