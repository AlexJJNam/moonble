import React from 'react';

const BULLETS = [
  '일반 질문 시에도 자동으로 적합한 툴로 답변하며, 분석방법 선호도를 기준으로만 툴을 호출하지 않습니다.',
  '사용자 설정은 최초 세팅 시, 자동으로 설정값을 기억하며, 설정 조회 및 재설정을 희망하는 경우 "설정" 또는 "시작"을 통해 재설정하실 수 있습니다.',
];

export default function Tooltip({ anchorRef }) {
  const [pos, setPos] = React.useState(null);

  React.useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  }, [anchorRef]);

  if (!pos) return null;

  return (
    <div style={{
      position: 'fixed',
      top: pos.top,
      right: pos.right,
      width: 300,
      background: '#fdfdfd',
      border: '1px solid #d1d1d1',
      borderRadius: 14,
      boxShadow: '4px 6px 24px 0px rgba(105,105,105,0.1)',
      padding: '12px 10px',
      zIndex: 9999,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:2, marginBottom:6 }}>
        <span style={{ fontSize:14, color:'#5d5d5d', fontWeight:500, lineHeight:'20px', letterSpacing:'-0.014px' }}>
          ⓘ 사용법 안내
        </span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {BULLETS.map((text, i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:4 }}>
            <span style={{ fontSize:12, color:'#5d5d5d', lineHeight:'20px', flexShrink:0 }}>•</span>
            <p style={{ fontSize:12, color:'#5d5d5d', lineHeight:'20px', letterSpacing:'-0.012px', margin:0 }}>{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
