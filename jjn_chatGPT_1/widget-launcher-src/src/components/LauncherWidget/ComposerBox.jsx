import React, { useRef, useEffect } from 'react';
import ModeToggle from './ModeToggle';
import SendButton from './SendButton';

export default function ComposerBox({ placeholder, showMode, text, onTextChange, mode, onModeChange, onSend }) {
  const taRef = useRef(null);
  const hasText = text.trim().length > 0;

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [text]);

  return (
    <div style={{ background:'#f8f8f8', borderRadius:16, overflow:'hidden', width:'100%', flexShrink:0 }}>
      <div style={{ padding:'12px 28px 4px 20px' }}>
        <textarea
          ref={taRef}
          value={text}
          onChange={e => onTextChange(e.target.value)}
          placeholder={placeholder}
          rows={1}
          style={{
            width:'100%', display:'block', background:'none', border:'none', outline:'none',
            resize:'none', overflow:'hidden', fontSize:14, fontWeight:400,
            lineHeight:1.45, letterSpacing:'-0.014px', color:'#0d0d0d',
            fontFamily:'inherit', padding:0,
          }}
        />
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 16px 12px 18px', gap:8 }}>
        {showMode ? <ModeToggle mode={mode} onChange={onModeChange} /> : <div style={{ flex:1 }} />}
        <SendButton active={hasText} onClick={onSend} />
      </div>
    </div>
  );
}
