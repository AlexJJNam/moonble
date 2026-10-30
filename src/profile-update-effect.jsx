import React from 'react';
import { createPortal } from 'react-dom';
import './profile-update-effect.css';

export function ProfileUpdateEffect({ message, onComplete }) {
  return createPortal(<div className="account-profile-update-fx is-playing" role="status" aria-live="assertive" onAnimationEnd={event => {
    if (event.target === event.currentTarget && event.animationName === 'account-profile-update-out') onComplete();
  }}>
    <span className="account-profile-update-badge" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M13.5 24.8l7 7L35 17.5" /></svg></span>
    <strong>{message}</strong>
  </div>, document.body);
}
