import React from 'react';
import { Pencil } from 'lucide-react';

// A consistent editing affordance; drawing tools use their own pen icon.
export function EditIcon({ size = 16, ...props }) {
  return <Pencil size={size} strokeWidth={2.4} aria-hidden="true" {...props} />;
}
