import React from 'react';
import s from './ModeToggle.module.css';

const MODES = [
  { v:'normal', l:'일반모드 (~2분)' },
  { v:'debate', l:'토론모드 (~10분)' },
];

export default function ModeToggle({ mode, onChange }) {
  return (
    <div className={s.wrap}>
      {MODES.map(o => {
        const on = mode === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} className={s.btn}
            style={{
              background:    on ? '#4d4d4d' : '#f2f3f5',
              color:         on ? '#fff'    : '#71717b',
              fontWeight:    on ? 700       : 400,
              letterSpacing: on ? '-0.5px'  : '-0.012px',
            }}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}
