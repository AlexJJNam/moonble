import React, { forwardRef } from 'react';

export const FlowActionButton = forwardRef(function FlowActionButton({ className = '', children, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} className={`mb-flow-action${className ? ` ${className}` : ''}`} {...props}>{children}</button>;
});

FlowActionButton.displayName = 'FlowActionButton';
