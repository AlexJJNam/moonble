import React from 'react';
import { ICON_INSET } from '../../constants/rows';
import { RISK_OPTS, STYLE_OPTS, PERIOD_OPTS, METHOD_CHIPS, DOT_COLORS } from '../../constants/settings';
import SegmentControl from './SegmentControl';
import MethodChips from './MethodChips';
import SummaryTag from './SummaryTag';

const SEG_ROWS = [
  { label:'위험성향',    opts:RISK_OPTS,   key:'risk',   variant:'dark'  },
  { label:'스타일 선호도', opts:STYLE_OPTS, key:'style',  variant:'light' },
  { label:'투자기간',    opts:PERIOD_OPTS, key:'period', variant:'light' },
];

export default function SettingsSection({ open, onToggle, risk, onRisk, stylePref, onStylePref, period, onPeriod, method, onMethod }) {
  const methodLabel = method ? METHOD_CHIPS.find(c => c.id === method)?.label ?? null : null;

  const vals = { risk, style: stylePref, period };
  const setters = { risk: onRisk, style: onStylePref, period: onPeriod };

  return (
    <div style={{ background:'#fff', padding:'8px 16px 16px', flexShrink:0 }}>
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', gap:8, height:36 }}>
        <div style={{ flex:'1 0 0', display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
          <div style={{ width:28, height:28, borderRadius:10, background:'#f9f9f9', display:'flex', alignItems:'center', justifyContent:'center', padding:4, flexShrink:0, overflow:'hidden' }}>
            <div style={{ position:'relative', width:18, height:18, flexShrink:0 }}>
              <div style={{ position:'absolute', inset: ICON_INSET.settings, overflow:'hidden' }}>
                <img src="./assets/widget-launcher/icon-settings.svg" alt="" style={{ position:'absolute', display:'block', inset:0, maxWidth:'none', width:'100%', height:'100%' }} />
              </div>
            </div>
          </div>
          <span style={{ fontSize:14, fontWeight:400, color:'#0d0d0d', lineHeight:1.45, letterSpacing:'-0.014px' }}>설정</span>
        </div>
        <button onClick={onToggle} aria-label={open ? '접기' : '펼치기'}
          style={{ width:28, height:28, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', padding:2 }}>
          <div style={{ position:'relative', width:24, height:24, flexShrink:0, transform: open ? 'scaleY(-1)' : 'none' }}>
            <div style={{ position:'absolute', inset: ICON_INSET.chevron, overflow:'hidden' }}>
              <img src="./assets/widget-launcher/icon-chevron.svg" alt="" style={{ position:'absolute', display:'block', inset:0, maxWidth:'none', width:'100%', height:'100%' }} />
            </div>
          </div>
        </button>
      </div>

      {/* 설정 패널 */}
      {open && (
        <div style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'8px 0' }}>
            <p style={{ fontSize:14, fontWeight:400, color:'#0d0d0d', lineHeight:1.45, letterSpacing:'-0.014px', marginBottom:10 }}>투자성향</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {SEG_ROWS.map(row => (
                <div key={row.key} style={{ background:'#fafbfd', borderRadius:12, padding:'12px 16px' }}>
                  <p style={{ fontSize:14, fontWeight:400, color:'#0d0d0d', lineHeight:1.45, letterSpacing:'-0.014px', marginBottom:6 }}>{row.label}</p>
                  <SegmentControl options={row.opts} value={vals[row.key]} onChange={setters[row.key]} variant={row.variant} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding:'8px 0 12px' }}>
            <p style={{ fontSize:14, fontWeight:400, color:'#0d0d0d', lineHeight:1.45, letterSpacing:'-0.014px', marginBottom:10 }}>분석방법 선호도</p>
            <MethodChips selected={method} onChange={onMethod} />
          </div>
        </div>
      )}

      {/* 요약 태그 — 항상 표시 */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, paddingTop: open ? 0 : 4 }}>
        <SummaryTag dot={DOT_COLORS[0]} label="위험성향" value={RISK_OPTS[risk]} />
        <SummaryTag dot={DOT_COLORS[1]} label="스타일"   value={STYLE_OPTS[stylePref]} />
        <SummaryTag dot={DOT_COLORS[2]} label="투자기간" value={PERIOD_OPTS[period]} />
        {methodLabel && <SummaryTag dot={DOT_COLORS[3]} label="선호 분석" value={methodLabel} />}
      </div>
    </div>
  );
}
