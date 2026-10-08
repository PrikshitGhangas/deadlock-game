import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Step cursor with autoplay and keyboard shortcuts (← → Space Home End).
 * @param {number} total number of steps
 */
export function useStepper(total, active = true) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // steps per second
  const totalRef = useRef(total);
  totalRef.current = total;

  useEffect(() => { setIndex(0); setPlaying(false); }, [total]);

  const clamp = useCallback((i) => Math.max(0, Math.min(totalRef.current - 1, i)), []);
  const goTo = useCallback((i) => setIndex(clamp(i)), [clamp]);
  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);
  const first = useCallback(() => setIndex(0), []);
  const last = useCallback(() => setIndex(clamp(Infinity)), [clamp]);

  useEffect(() => {
    if (!playing) return undefined;
    if (index >= total - 1) { setPlaying(false); return undefined; }
    const id = setTimeout(() => setIndex((i) => clamp(i + 1)), 1000 / speed);
    return () => clearTimeout(id);
  }, [playing, index, total, speed, clamp]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === 'Home') { e.preventDefault(); first(); }
      else if (e.key === 'End') { e.preventDefault(); last(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, first, last, active]);

  return { index, total, playing, speed, setSpeed, goTo, next, prev, first, last, toggle: () => setPlaying((p) => !p), setPlaying };
}
