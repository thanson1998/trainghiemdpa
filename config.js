// Điền URL Worker sau khi triển khai; không đặt mật khẩu hoặc API token ở đây.
const dpaApiBase = "https://trainghiemdpa.thanson198.workers.dev";
window.DPA_CONFIG = { apiBase: dpaApiBase };
try {
  localStorage.setItem('dpa-sync-endpoint', dpaApiBase);
  const currentUrl = new URL(location.href);
  if (currentUrl.searchParams.has('api')) {
    currentUrl.searchParams.delete('api');
    history.replaceState(null, '', currentUrl.href);
  }
} catch {}
