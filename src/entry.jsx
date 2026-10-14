import { loginUrl, supabase } from './supabase.js';
import { hasProfile } from './profile.js';
import './design-system.css';

function moveTo(path) {
  window.location.replace(new URL(path, window.location.href));
}

document.body.style.margin = '0';
document.body.style.background = 'var(--mb-bg)';
document.querySelector('.entry-check').style.cssText = 'min-height:100vh;min-height:100dvh;display:grid;place-content:center;color:var(--mb-primary-strong)';

if (!supabase) {
  window.location.replace(loginUrl());
} else {
  supabase.auth.getSession().then(({ data, error }) => {
    if (error || !data.session) {
      window.location.replace(loginUrl());
      return;
    }
    moveTo(hasProfile(data.session.user) ? './quiz.html' : './prd.html#/register-name');
  }).catch(() => window.location.replace(loginUrl()));
}
