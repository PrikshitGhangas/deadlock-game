import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function buildStyle() {
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        color: '#fff',
        'font-weight': 700,
        'font-size': 14,
        'font-family': cssVar('--font') || 'sans-serif',
        width: 46,
        height: 46,
        'background-color': cssVar('--node-idle'),
        'border-width': 3,
        'border-color': cssVar('--bg-elev'),
      },
    },
    { selector: 'node.active', style: { 'background-color': cssVar('--node-active') } },
    { selector: 'node.blocked', style: { 'background-color': cssVar('--node-blocked'), shape: 'round-rectangle' } },
    { selector: 'node.aborted', style: { 'background-color': cssVar('--node-aborted'), shape: 'diamond', width: 52, height: 52 } },
    { selector: 'node.committed', style: { 'background-color': cssVar('--node-committed'), shape: 'round-hexagon' } },
    { selector: 'node.idle', style: { 'background-color': cssVar('--node-idle') } },
    { selector: 'node.visiting', style: { 'border-color': cssVar('--node-visiting'), 'border-width': 5, width: 54, height: 54 } },
    { selector: 'node.done', style: { 'border-color': cssVar('--node-done'), 'border-width': 5 } },
    { selector: 'node.cycle', style: { 'border-color': cssVar('--edge-cycle'), 'border-width': 6 } },
    { selector: 'node.current', style: { width: 56, height: 56 } },
    {
      selector: 'edge',
      style: {
        width: 3,
        'line-color': cssVar('--edge'),
        'target-arrow-color': cssVar('--edge'),
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1.4,
        'curve-style': 'bezier',
        'control-point-step-size': 60,
        label: 'data(label)',
        'font-size': 11,
        color: cssVar('--fg-muted'),
        'text-background-color': cssVar('--bg-sunken'),
        'text-background-opacity': 1,
        'text-background-padding': 2,
        'text-background-shape': 'roundrectangle',
      },
    },
    { selector: 'edge.traversed', style: { 'line-color': cssVar('--node-visiting'), 'target-arrow-color': cssVar('--node-visiting'), width: 4 } },
    { selector: 'edge.cycle', style: { 'line-color': cssVar('--edge-cycle'), 'target-arrow-color': cssVar('--edge-cycle'), width: 5 } },
  ];
}

/**
 * Wait-for graph rendered with Cytoscape.js.
 * @param {{step: object, txns: string[], theme: string, animate?: boolean, height?: number}} props
 */
export default function WaitForGraph({ step, txns = [], theme, animate = true, height = 340, visible = true, emptyText = 'Run a simulation to see the wait-for graph' }) {
  const ref = useRef(null);
  const cyRef = useRef(null);
  const timersRef = useRef([]);
  const laidOut = useRef(false); // true once a layout ran with a real (non-zero) container size
  const [dfsPhase, setDfsPhase] = useState('');
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  // create once
  useEffect(() => {
    const cy = cytoscape({
      container: ref.current,
      style: buildStyle(),
      layout: { name: 'circle' },
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autoungrabify: false,
      minZoom: 0.5,
      maxZoom: 2,
    });
    cyRef.current = cy;
    return () => cy.destroy();
  }, []);

  // hidden tabs give the container zero size; refit when shown
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !visible) return;
    const id = setTimeout(() => { cy.resize(); cy.fit(undefined, 40); }, 0);
    return () => clearTimeout(id);
  }, [visible]);

  // restyle when theme flips
  useEffect(() => {
    // next frame: by then App has applied data-theme to <html>, so CSS vars are current
    const id = setTimeout(() => cyRef.current?.style().fromJson(buildStyle()).update(), 0);
    return () => clearTimeout(id);
  }, [theme]);

  // sync with step
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    clearTimers();
    setDfsPhase('');

    const nodes = step?.wfg?.nodes?.length ? step.wfg.nodes : txns;
    const edges = step?.wfg?.edges || [];
    const prevIds = cy.nodes().map((n) => n.id()).sort().join(',');
    const positions = {};
    cy.nodes().forEach((n) => { positions[n.id()] = { ...n.position() }; });

    cy.elements().remove();
    cy.add(nodes.map((id) => ({ data: { id, label: id }, position: positions[id] })));
    cy.add(edges.map((e, i) => ({ data: { id: `e${i}-${e.from}-${e.to}`, source: e.from, target: e.to, label: e.res || '' } })));

    // Layout/fit on the next tick: when a run is triggered during mount (deep links, history)
    // the container has not been laid out yet and Cytoscape would measure it as 0×0.
    // (setTimeout rather than requestAnimationFrame — rAF never fires in a background tab.)
    const relayout = prevIds !== nodes.slice().sort().join(',') || !laidOut.current;
    const layoutTimer = setTimeout(() => {
      cy.resize();
      if (relayout) {
        cy.layout({ name: 'circle', fit: true, padding: 40, animate: false }).run();
        if (cy.width() > 0) laidOut.current = true;
      } else {
        cy.fit(undefined, 40);
      }
    }, 0);
    timersRef.current.push(layoutTimer);

    // statuses
    nodes.forEach((id) => {
      const st = step?.statuses?.[id] || 'idle';
      cy.$id(id).addClass(st);
    });
    if (step?.txn) cy.$id(step.txn).addClass('current');

    const cycle = step?.cycle;
    const markCycle = () => {
      if (!cycle) return;
      for (let i = 0; i < cycle.length - 1; i++) {
        cy.$id(cycle[i]).addClass('cycle');
        cy.edges(`[source = "${cycle[i]}"][target = "${cycle[i + 1]}"]`).addClass('cycle');
      }
    };

    if (animate && step?.dfs?.length) {
      // replay DFS trace
      const perEvent = Math.min(350, Math.max(120, 2400 / step.dfs.length));
      step.dfs.forEach((ev, i) => {
        const t = setTimeout(() => {
          if (ev.type === 'visit') { cy.$id(ev.node).addClass('visiting'); setDfsPhase(`DFS visits ${ev.node}`); }
          else if (ev.type === 'edge') { cy.edges(`[source = "${ev.from}"][target = "${ev.to}"]`).addClass('traversed'); setDfsPhase(`DFS follows ${ev.from} → ${ev.to}`); }
          else if (ev.type === 'backtrack') { cy.$id(ev.node).removeClass('visiting').addClass('done'); setDfsPhase(`DFS backtracks from ${ev.node}`); }
          else if (ev.type === 'cycleFound') { markCycle(); setDfsPhase(`Cycle found: ${ev.cycle.join(' → ')}`); }
        }, perEvent * (i + 1));
        timersRef.current.push(t);
      });
      const end = setTimeout(() => { if (!cycle) setDfsPhase('DFS finished — no cycle'); }, perEvent * (step.dfs.length + 1));
      timersRef.current.push(end);
    } else {
      markCycle();
    }
    return clearTimers;
  }, [step, txns, animate]);

  const exportPng = () => {
    const cy = cyRef.current;
    if (!cy) return;
    const png = cy.png({ full: true, scale: 2, bg: cssVar('--bg-sunken') });
    const a = document.createElement('a');
    a.href = png;
    a.download = `wait-for-graph-step-${(step?.index ?? 0) + 1}.png`;
    a.click();
  };

  const empty = !step;
  return (
    <div>
      <div className="graph-wrap" style={{ height }} role="img" aria-label={step ? `Wait-for graph with ${step.wfg.edges.length} edges${step.cycle ? `, cycle ${step.cycle.join(' to ')}` : ''}` : 'Empty wait-for graph'}>
        <div className="cy" ref={ref} />
        {empty && <div className="graph-empty">{emptyText}</div>}
        <div className="graph-toolbar">
          {dfsPhase && <span className="chip chip-active" aria-live="polite">{dfsPhase}</span>}
          <button className="btn btn-sm" onClick={exportPng} disabled={empty} title="Download PNG">PNG</button>
        </div>
      </div>
      <div className="graph-legend" aria-hidden="true">
        <span style={{ '--c': 'var(--node-active)' }}>active</span>
        <span style={{ '--c': 'var(--node-blocked)' }}>blocked</span>
        <span style={{ '--c': 'var(--node-aborted)' }}>aborted</span>
        <span style={{ '--c': 'var(--node-committed)' }}>committed</span>
        <span style={{ '--c': 'var(--node-visiting)' }}>DFS visiting</span>
        <span style={{ '--c': 'var(--edge-cycle)' }}>cycle</span>
      </div>
    </div>
  );
}
