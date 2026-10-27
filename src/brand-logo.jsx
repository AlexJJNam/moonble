import React from 'react';

export function BrandLogo({ className = '', decorative = false }) {
  return <img
    className={`mb-brand-wordmark${className ? ` ${className}` : ''}`}
    src="./assets/moonble-wordmark.svg"
    width="112"
    height="37"
    alt={decorative ? '' : 'moonble'}
    aria-hidden={decorative ? 'true' : undefined}
  />;
}
