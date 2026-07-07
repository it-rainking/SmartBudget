// Blocking inline script that sets the `dark` class before first paint,
// avoiding a flash of the wrong theme. Allowed by the CSP's
// script-src 'unsafe-inline' (see next.config.ts).
export const themeScript = `(function(){var t=localStorage.getItem('theme');var d=document.documentElement;if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('dark')}else{d.classList.remove('dark')}})()`
