import React, { forwardRef } from 'react';

export const FlowActionButton = forwardRef(function FlowActionButton({ className = '', children, type = 'button', size = 'default', ...props }, ref) {
  const sizeClass = size === 'compact' ? ' mb-flow-action--compact' : '';
  return <button ref={ref} type={type} className={`mb-flow-action${sizeClass}${className ? ` ${className}` : ''}`} {...props}>{children}</button>;
});

FlowActionButton.displayName = 'FlowActionButton';
