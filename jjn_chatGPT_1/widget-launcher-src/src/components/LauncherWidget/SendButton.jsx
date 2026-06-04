import React from 'react';
import { ICON_INSET } from '../../constants/rows';

export default function SendButton({ active, onClick }) {
  return (
    <button onClick={active ? onClick : undefined} aria-label="전송"
      style={{
        width:28, height:28, flexShrink:0, borderRadius:'50%', padding:4,
        display:'flex', alignItems:'center', justifyContent:'center',
        background: active ? '#0285ff' : '#cbcbcb',
        cursor: active ? 'pointer' : 'default',
        transition:'background 0.15s',
      }}>
      <div style={{ position:'relative', width:20, height:20, flexShrink:0 }}>
        <div style={{ position:'absolute', inset: ICON_INSET.send, overflow:'hidden' }}>
          <img src="./assets/widget-launcher/icon-send.svg" alt="" style={{ position:'absolute', display:'block', inset:0, maxWidth:'none', width:'100%', height:'100%' }} />
        </div>
      </div>
    </button>
  );
}
