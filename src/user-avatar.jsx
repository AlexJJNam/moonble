import React, { useEffect, useState } from 'react';
import { profileOf } from './profile.js';
import { profileAvatarUrl } from './profile-avatar.js';

export function UserAvatar({ user, className = '' }) {
  const path = user?.user_metadata?.avatarPath || '';
  const [image, setImage] = useState({ path: '', src: '' });
  const initial = [...(profileOf(user).name || 'M')][0];

  useEffect(() => {
    let active = true;
    if (path) profileAvatarUrl(user).then(src => {
      if (active) setImage({ path, src });
    }).catch(() => { if (active) setImage({ path, src: '' }); });
    return () => { active = false; };
  }, [user?.id, path]);

  const src = image.path === path ? image.src : '';
  return <span className={`mb-user-avatar ${className}`} aria-hidden="true">
    {src ? <img src={src} alt="" draggable={false} decoding="async" onError={() => setImage({ path, src: '' })} /> : initial}
  </span>;
}
