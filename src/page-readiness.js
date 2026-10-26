// Hand the first paint loader over only after React has committed its loading or ready view.
export function revealPage() {
  document.documentElement.removeAttribute('data-page-pending');
}
