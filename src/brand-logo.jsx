import React from 'react';

export function BrandLogo({ className = '', decorative = false }) {
  return <img
    className={`mb-brand-wordmark${className ? ` ${className}` : ''}`}
    src="./assets/moonble-wordmark.svg"
    alt={decorative ? '' : 'moonble'}
    aria-hidden={decorative ? 'true' : undefined}
  />;
}
