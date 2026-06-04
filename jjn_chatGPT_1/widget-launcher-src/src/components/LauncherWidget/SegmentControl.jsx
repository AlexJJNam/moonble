import React from 'react';

export default function SegmentControl({ options, value, onChange, variant }) {
  const dark = variant === 'dark';
  return (
    <div style={{ display:'flex', background:'#f2f3f5', borderRadius:14, padding:4, gap:4, width:'100%', alignItems: dark ? 'flex-start' : 'stretch', ...(!dark && { height:42 }) }}>
      {options.map((opt, i) => {
        const on = value === i;
        return (
          <button key={opt} onClick={() => onChange(i)} style={{
            flex:'1 0 0', minWidth:0, borderRadius:10,
            padding: dark ? '6px 4px' : '0 4px',
            fontSize:12,
            lineHeight: dark ? 1.2 : 1.45,
            fontWeight: on ? 500 : 400,
            whiteSpace:'normal', wordBreak:'keep-all', textAlign:'center',
            transition:'all 0.15s',
            ...(dark ? {
              alignSelf: 'stretch',
              background: on ? '#404040' : '#fff',
              color: on ? '#fff' : '#71717b',
              boxShadow: on ? '0 1px 1.5px rgba(0,0,0,.1),0 1px 1px rgba(0,0,0,.1)' : 'none',
            } : {
              height:'100%',
              background: on ? '#fff' : '#f2f3f5',
              color: on ? '#141414' : '#71717b',
              letterSpacing: on ? '-1px' : '-0.012px',
              boxShadow: on ? '0 1px 1.5px rgba(0,0,0,.1),0 1px 1px rgba(0,0,0,.1)' : 'none',
            }),
          }}>{opt}</button>
        );
      })}
    </div>
  );
}
