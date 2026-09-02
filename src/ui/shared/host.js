// Are we running inside the Windows program (WebView2 host) rather than a web browser?
export function isDesktopApp() {
  return typeof window !== 'undefined' && !!window.__monteithHost;
}

export function hostVersion() {
  return (typeof window !== 'undefined' && window.__monteithHost && window.__monteithHost.version) || null;
}
