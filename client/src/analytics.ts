const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;

if (endpoint && websiteId) {
  try {
    const url = new URL(endpoint);
    // Only allow HTTPS in production to prevent XSS via tampered env vars
    if (import.meta.env.PROD && url.protocol !== 'https:') {
      console.warn('[analytics] Blocked non-HTTPS analytics endpoint in production.');
    } else {
      const script = document.createElement('script');
      script.defer = true;
      script.src = `${url.origin}/umami`;
      script.dataset.websiteId = websiteId;
      document.head.appendChild(script);
    }
  } catch {
    console.warn('[analytics] Invalid analytics endpoint URL.');
  }
}
