import React from 'react';
import { ICON_INSET } from '../../constants/rows';

export default function ToggleBtn({ isOpen }) {
  return (
    <div style={{ width:28, height:28, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
      {isOpen ? (
        <div style={{ position:'relative', width:24, height:24 }}>
          <div style={{ position:'absolute', inset: ICON_INSET.close, overflow:'hidden' }}>
            <img src="./assets/widget-launcher/icon-close.svg" alt="" style={{ position:'absolute', display:'block', inset:0, maxWidth:'none', width:'100%', height:'100%' }} />
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', position:'relative', width:33.941, height:33.941 }}>
          <div style={{ transform:'rotate(-45deg)', flexShrink:0 }}>
            <div style={{ position:'relative', width:24, height:24 }}>
              <div style={{ position:'absolute', inset: ICON_INSET.close, overflow:'hidden' }}>
                <img src="./assets/widget-launcher/icon-close.svg" alt="" style={{ position:'absolute', display:'block', inset:0, maxWidth:'none', width:'100%', height:'100%' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
