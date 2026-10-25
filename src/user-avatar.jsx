import React, { useEffect, useState } from 'react';
import { profileOf } from './profile.js';
import { cachedProfileAvatarUrl, profileAvatarUrl } from './profile-avatar.js';

export function UserAvatar({ user, className = '' }) {
  const path = user?.user_metadata?.avatarPath || '';
  const [image, setImage] = useState(() => ({ path, src: cachedProfileAvatarUrl(user) }));
  const initial = [...(profileOf(user).name || 'M')][0];

  useEffect(() => {
    let active = true;
    if (path) profileAvatarUrl(user).then(src => {
      if (!active || !src) return;
      const preview = new Image();
      preview.onload = () => { if (active) setImage({ path, src }); };
      preview.onerror = () => { if (active) setImage(current => current.path === path && current.src ? current : { path, src: '' }); };
      preview.src = src;
    }).catch(() => { if (active) setImage(current => current.path === path && current.src ? current : { path, src: '' }); });
    return () => { active = false; };
  }, [user?.id, path]);

  const src = image.path === path ? image.src : cachedProfileAvatarUrl(user);
  return <span className={`mb-user-avatar ${className}`} aria-hidden="true">
    {src ? <img src={src} alt="" draggable={false} decoding="async" onError={() => setImage({ path, src: '' })} /> : initial}
  </span>;
}
