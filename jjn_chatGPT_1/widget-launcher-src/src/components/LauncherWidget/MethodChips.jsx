import React from 'react';
import { METHOD_CHIPS } from '../../constants/settings';

export default function MethodChips({ selected, onChange }) {
  return (
    <div style={{ display:'flex', gap:4, width:'100%' }}>
      {METHOD_CHIPS.map(c => {
        const on = selected === c.id;
        return (
          <button key={c.id}
            onClick={() => onChange(c.id)}
            style={{
              flex:'1 0 0', minWidth:0, height:34,
              display:'flex', alignItems:'center', justifyContent:'center',
              borderRadius:10, overflow:'hidden', padding:'0 16px',
              background: on ? c.bg : '#f3f3f3',
              color: on ? c.color : '#0d0d0d',
              fontSize:12, fontWeight: on ? 700 : 400,
              letterSpacing: on ? '-1px' : '-0.012px',
              lineHeight:1.45, whiteSpace:'nowrap', textOverflow:'ellipsis',
              transition:'all .15s',
            }}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
