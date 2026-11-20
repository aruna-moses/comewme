// Boot guard — runs before the app bundle.
//
// If a deploy replaced the hashed entry files while this page was cached, the
// module script 404s and the page stays blank. This reloads once so the fresh
// index.html brings the fresh filenames. A short cooldown stops reload loops
// when the device is genuinely offline or the deploy itself is broken.
;(function () {
  var KEY = 'comewme:boot-reload'
  var lastReload = 0
  try {
    lastReload = Number(sessionStorage.getItem(KEY) || 0)
  } catch (error) {
    lastReload = 0
  }

  function reloadOnce() {
    if (Date.now() - lastReload < 30000) return false
    try {
      sessionStorage.setItem(KEY, String(Date.now()))
    } catch (error) {
      return false
    }
    location.reload()
    return true
  }

  // A hashed asset failing to load is always a stale-HTML problem, never a bug.
  window.addEventListener(
    'error',
    function (event) {
      var el = event.target
      if (!el || !el.tagName) return
      var url = el.src || el.href || ''
      if ((el.tagName === 'SCRIPT' || el.tagName === 'LINK') && /\/assets\//.test(url)) {
        reloadOnce()
      }
    },
    true,
  )

  // Safari occasionally swallows module-script load errors. If the app never
  // mounted and we're online, one refresh is still the right answer.
  window.addEventListener('load', function () {
    if (!navigator.onLine) return
    window.setTimeout(function () {
      var root = document.getElementById('root')
      if (root && root.childElementCount === 0) reloadOnce()
    }, 12000)
  })
})()
