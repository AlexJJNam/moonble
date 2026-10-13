// Display-only metadata; never use these fields for access control.
export function profileOf(user) {
  const data = user?.user_metadata || {};
  return {
    name: typeof data.name === 'string' ? data.name.trim() : '',
    companyName: typeof data.companyName === 'string' ? data.companyName.trim() : '',
  };
}
export function hasProfile(user) {
  const profile = profileOf(user);
  return Boolean(profile.name && profile.companyName);
}
