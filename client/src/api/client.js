/** Thin fetch wrappers for the backend. All calls go through the Vite proxy (/api → :3001). */

async function req(path, options = {}) {
  let res;
  try {
    res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch {
    throw new Error('Cannot reach the server. Is `npm run dev` running?');
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => req('/api/health'),
  samples: () => req('/api/samples'),
  history: {
    list: () => req('/api/history'),
    get: (id) => req(`/api/history/${id}`),
    save: (run) => req('/api/history', { method: 'POST', body: JSON.stringify(run) }),
    remove: (id) => req(`/api/history/${id}`, { method: 'DELETE' }),
    clear: () => req('/api/history', { method: 'DELETE' }),
    exportUrl: (id, format) => `/api/history/${id}/export?format=${format}`,
  },
  scores: {
    list: () => req('/api/scores'),
    save: (s) => req('/api/scores', { method: 'POST', body: JSON.stringify(s) }),
  },
  tutorLog: (entry) => req('/api/tutor-log', { method: 'POST', body: JSON.stringify(entry) }).catch(() => null),
  ai: {
    status: () => req('/api/ai/status'),
    ask: (payload) => req('/api/ai/ask', { method: 'POST', body: JSON.stringify(payload) }),
  },
  analytics: () => req('/api/analytics'),
};

/** Trigger a browser download of a text blob. */
export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
