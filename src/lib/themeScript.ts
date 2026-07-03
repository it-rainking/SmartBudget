// Blocking inline script that sets the `dark` class before first paint,
// avoiding a flash of the wrong theme. Kept as a single exported constant so
// layout.tsx and next.config.ts's CSP script-src hash never drift apart —
// if you edit this string, the CSP hash in next.config.ts must be
// recomputed (see the comment there) or the script will be blocked.
export const themeScript = `(function(){var t=localStorage.getItem('theme');var d=document.documentElement;if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('dark')}else{d.classList.remove('dark')}})()`
