try {
  if (localStorage.getItem('comewme-theme') === 'dark') {
    document.documentElement.dataset.theme = 'dark'
  }
} catch {
  // The app defaults to light mode when persistent storage is unavailable.
}
