/**
 * Deep links: the query string can describe a scenario so a run can be shared or
 * screenshotted without clicking.
 *
 *   ?sample=classic-2&step=5#detection
 *   ?s=<base64 schedule>&policy=fewestLocks#detection
 *   ?s=<base64 schedule>&scheme=wound-wait#prevention
 *   ?sample=bankers-safe#bankers      ?level=L3#game
 */

const enc = (t) => btoa(unescape(encodeURIComponent(t)));
const dec = (t) => { try { return decodeURIComponent(escape(atob(t))); } catch { return ''; } };

export function readUrlParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    sample: q.get('sample'),
    schedule: q.get('s') ? dec(q.get('s')) : null,
    policy: q.get('policy'),
    scheme: q.get('scheme'),
    step: q.has('step') ? Math.max(0, Number(q.get('step')) - 1) : null,
    level: q.get('level'),
    theme: q.get('theme'),
  };
}

/** Build a shareable URL for the current run. */
export function buildShareUrl(mode, input, stepIndex, sampleId) {
  const q = new URLSearchParams();
  if (sampleId) q.set('sample', sampleId);
  else if (input?.schedule) q.set('s', enc(input.schedule));
  if (input?.victimPolicy) q.set('policy', input.victimPolicy);
  if (input?.scheme) q.set('scheme', input.scheme);
  if (stepIndex != null) q.set('step', String(stepIndex + 1));
  return `${window.location.origin}${window.location.pathname}?${q.toString()}#${mode}`;
}
