import React from 'react';
import './segmented-control.css';

export function SegmentedControl({ ariaLabel, className = '', iconOnly = false, items, onChange, value }) {
  const activeIndex = Math.max(0, items.findIndex(item => item.value === value));

  return <div
    className={`mb-segmented${iconOnly ? ' is-icon-only' : ''}${className ? ` ${className}` : ''}`}
    role="group"
    aria-label={ariaLabel}
    style={{ '--segment-count': items.length, '--segment-index': activeIndex }}
  >
    <span className="mb-segmented-indicator" aria-hidden="true" />
    {items.map(item => {
      const Icon = item.icon;
      return <button
        key={item.value}
        type="button"
        aria-label={item.ariaLabel || item.label}
        aria-pressed={item.value === value}
        onClick={() => onChange(item.value)}
      >
        {Icon && <Icon size={17} aria-hidden="true" />}
        <span className={iconOnly ? 'mb-sr-only' : undefined}>{item.label}</span>
      </button>;
    })}
  </div>;
}
