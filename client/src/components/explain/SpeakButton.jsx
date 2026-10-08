import { useEffect, useState } from 'react';
import { Icon } from '../common/Icons.jsx';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Reads the given text aloud with the Web Speech API (free, offline in most browsers). */
export default function SpeakButton({ text, label = 'Read aloud' }) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, []);
  useEffect(() => { if (supported && speaking) { window.speechSynthesis.cancel(); setSpeaking(false); } }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supported) return null;

  const toggle = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  return (
    <button className="btn btn-sm" onClick={toggle} aria-pressed={speaking} title={label} disabled={!text}>
      {speaking ? <><Icon name="stop" size={13} /> Stop</> : <><Icon name="volume" size={13} /> Listen</>}
    </button>
  );
}
