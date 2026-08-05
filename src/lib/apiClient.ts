/**
 * Parse an API Response as JSON with clear errors when a proxy/WAF
 * (e.g. DOE Zscaler) returns an HTML block page instead of JSON.
 */
export async function readApiJson<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  const trimmed = text.trimStart();
  const looksLikeHtml =
    trimmed.startsWith('<')
    || trimmed.startsWith('<!')
    || trimmed.startsWith('<!--');

  if (looksLikeHtml || (contentType.includes('text/html') && !contentType.includes('application/json'))) {
    if (/zscaler/i.test(text) || trimmed.startsWith('<!--#')) {
      throw new Error(
        'Your network security filter (Zscaler) blocked this request. '
        + 'Ask IT to allow nycadultedlabels.nyc, or retry off the filtered network / on VPN that permits the site.',
      );
    }
    if (/sign[\s-]?in|Student Label System/i.test(text) && res.status >= 200 && res.status < 400) {
      throw new Error('Your session may have expired. Refresh the page and sign in again.');
    }
    throw new Error(
      `Server returned a web page instead of data (HTTP ${res.status}). Refresh and try again.`,
    );
  }

  if (!trimmed) {
    throw new Error(`Empty response from server (HTTP ${res.status}).`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from server (HTTP ${res.status}).`);
  }
}
