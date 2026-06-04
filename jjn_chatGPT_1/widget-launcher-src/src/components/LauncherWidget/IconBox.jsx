import React from 'react';

export default function IconBox({ src, size, inset, alt = '' }) {
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <div style={{ position:'absolute', inset, overflow:'hidden' }}>
        <img src={src} alt={alt} style={{
          position:'absolute', display:'block',
          top:0, left:0, right:0, bottom:0,
          maxWidth:'none', width:'100%', height:'100%',
        }} />
      </div>
    </div>
  );
}
