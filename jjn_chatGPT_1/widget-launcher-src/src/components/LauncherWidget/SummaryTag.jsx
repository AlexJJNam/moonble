import React from 'react';

export default function SummaryTag({ dot, label, value }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:4,
      background:'#fafbfd', filter:'drop-shadow(6px 4px 12px rgba(105,105,105,.1))',
      borderRadius:100000, padding:'4px 10px', flexShrink:0,
    }}>
      <div style={{ width:5, height:5, borderRadius:'50%', background:dot, flexShrink:0 }} />
      <span style={{ fontSize:12, fontWeight:500, color:'#141414', lineHeight:1.45, whiteSpace:'nowrap' }}>{label}</span>
      <div style={{ width:1, height:8, background:'rgba(0,0,0,.2)', flexShrink:0 }} />
      <span style={{ fontSize:12, fontWeight:500, color:'#141414', lineHeight:1.45, whiteSpace:'nowrap' }}>{value}</span>
    </div>
  );
}
