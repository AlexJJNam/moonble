import React from 'react';
import { ICON_INSET } from '../../constants/rows';
import ToggleBtn from './ToggleBtn';
import ComposerBox from './ComposerBox';

export default function AnalysisRow({ id, label, iconSrc, iconInset, placeholder, showMode, isActive, onToggle, text, onTextChange, mode, onModeChange, onSend }) {
  return (
    <div style={{ borderBottom:'1px solid rgba(13,13,13,0.05)', padding:'8px 16px', flexShrink:0 }}>
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <div
          onClick={onToggle}
          style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}
        >
          <div style={{ flex:'1 0 0', minWidth:0, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:28, height:28, borderRadius:10, background:'#ffebec', display:'flex', alignItems:'center', justifyContent:'center', padding:4, flexShrink:0, overflow:'hidden' }}>
              <div style={{ position:'relative', width:18, height:18, flexShrink:0 }}>
                <div style={{ position:'absolute', inset: iconInset, overflow:'hidden' }}>
                  <img src={iconSrc} alt="" style={{ position:'absolute', display:'block', inset:0, maxWidth:'none', width:'100%', height:'100%' }} />
                </div>
              </div>
            </div>
            <span style={{ fontSize:14, fontWeight:400, color:'#0d0d0d', lineHeight:1.45, letterSpacing:'-0.014px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0 }}>
              {label}
            </span>
          </div>
          <ToggleBtn isOpen={isActive} />
        </div>
        {isActive && (
          <ComposerBox
            placeholder={placeholder} showMode={showMode}
            text={text} onTextChange={onTextChange}
            mode={mode} onModeChange={onModeChange}
            onSend={onSend}
          />
        )}
      </div>
    </div>
  );
}
