import React, { useState, useRef } from 'react';
import { ICON_INSET } from '../../constants/rows';
import Tooltip from './Tooltip';

export default function CardHeader() {
  const [showTip, setShowTip] = useState(false);
  const btnRef = useRef(null);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 16px 8px', flexShrink:0 }}>
      <div>
        <p style={{ fontSize:15, fontWeight:500, color:'#000', lineHeight:1.45 }}>BNK 애널리스트AI</p>
        <p style={{ fontSize:14, fontWeight:400, color:'#5d5d5d', lineHeight:1.45, letterSpacing:'-0.014px' }}>무엇을 분석할까요?</p>
      </div>
      <button
        ref={btnRef}
        aria-label="도움말"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', padding:4, flexShrink:0 }}
      >
        <div style={{ position:'relative', width:24, height:24, overflow:'hidden' }}>
          <div style={{ position:'absolute', inset: ICON_INSET.help }}>
            <img src="./assets/widget-launcher/icon-help.svg" alt="" style={{ position:'absolute', display:'block', inset:0, maxWidth:'none', width:'100%', height:'100%' }} />
          </div>
        </div>
      </button>
      {showTip && <Tooltip anchorRef={btnRef} />}
    </div>
  );
}
