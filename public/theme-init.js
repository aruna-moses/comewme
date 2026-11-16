// Applies the saved theme before first paint. Lives in a file (not inline)
// because production CSP allows scripts from 'self' only.
try {
  if (localStorage.getItem('comewme-theme') === 'dark') {
    document.documentElement.dataset.theme = 'dark'
  }
} catch {
  // Storage can be unavailable in private modes - light theme is the default.
}
