import { useEffect, useState } from 'react';
import { api, downloadText } from '../../api/client.js';
import { toMarkdown, toJSON } from '../../engine/report.js';
import { Icon } from '../common/Icons.jsx';

/** Save-to-history / export buttons shown above a finished simulation. */
export default function ResultActions({ run, onSaved, toast, shareUrl = null }) {
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  useEffect(() => { setSavedId(null); }, [run?.result]);
  if (!run?.result) return null;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.history.save({ mode: run.mode, title: run.title, input: run.input, result: run.result });
      setSavedId(saved.id);
      onSaved?.(saved);
      toast?.(`Saved to history as #${saved.id}`);
    } catch (e) {
      toast?.(e.message);
    } finally {
      setSaving(false);
    }
  };
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  return (
    <div className="btn-group" style={{ alignItems: 'center' }}>
      <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>
        {saving ? <span className="spinner" /> : <Icon name="save" size={14} />} {savedId ? `Saved #${savedId}` : 'Save to history'}
      </button>
      {shareUrl && (
        <button className="btn btn-sm" title="Copy a link that reopens this run at the current step" onClick={async () => {
          try { await navigator.clipboard.writeText(shareUrl); toast?.('Link copied'); } catch { window.prompt('Copy this link', shareUrl); }
        }}>
          <Icon name="share" size={14} /> Share
        </button>
      )}
      <select
        className="btn btn-sm"
        style={{ width: 'auto', cursor: 'pointer', paddingRight: 20 }}
        aria-label="Export format"
        onChange={(e) => {
          if (e.target.value === 'md') {
            downloadText(`deadlock-${run.mode}-${stamp}.md`, toMarkdown({ ...run, createdAt: Date.now() }), 'text/markdown');
            toast?.('Markdown report downloaded');
          } else if (e.target.value === 'json') {
            downloadText(`deadlock-${run.mode}-${stamp}.json`, toJSON(run), 'application/json');
            toast?.('JSON exported');
          }
          e.target.value = '';
        }}
        defaultValue=""
      >
        <option value="" disabled>Export ▾</option>
        <option value="md">Report (.md)</option>
        <option value="json">Raw data (.json)</option>
      </select>
    </div>
  );
}
