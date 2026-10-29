import React, { useEffect, useState } from 'react';
import { profileOf } from './profile.js';
import { cachedProfileAvatarUrl, profileAvatarUrl } from './profile-avatar.js';

export function UserAvatar({ user, className = '' }) {
  const path = user?.user_metadata?.avatarPath || '';
  const [image, setImage] = useState(() => ({ path, src: cachedProfileAvatarUrl(user), loaded: false, failed: false }));
  const initial = [...(profileOf(user).name || 'M')][0];

  useEffect(() => {
    let active = true;
    if (!path) {
      setImage({ path: '', src: '', loaded: false, failed: false });
      return () => { active = false; };
    }
    setImage(current => ({ path, src: current.path === path ? current.src : cachedProfileAvatarUrl(user), loaded: false, failed: false }));
    profileAvatarUrl(user).then(src => {
      if (!active) return;
      if (!src) { setImage({ path, src: '', loaded: false, failed: true }); return; }
      setImage({ path, src, loaded: false, failed: false });
      const preview = new Image();
      preview.onload = () => { if (active) setImage({ path, src, loaded: true, failed: false }); };
      preview.onerror = () => { if (active) setImage({ path, src: '', loaded: false, failed: true }); };
      preview.src = src;
    }).catch(() => { if (active) setImage({ path, src: '', loaded: false, failed: true }); });
    return () => { active = false; };
  }, [user?.id, path]);

  const matchesPath = image.path === path;
  const src = matchesPath && image.loaded ? image.src : '';
  const failed = matchesPath && image.failed;
  const loading = Boolean(path) && !src && !failed;
  return <span className={`mb-user-avatar ${className}${loading ? ' is-loading' : ''}`} aria-hidden="true">
    {src ? <img src={src} alt="" draggable={false} decoding="async" onError={() => setImage({ path, src: '', loaded: false, failed: true })} /> : loading ? null : initial}
  </span>;
}
