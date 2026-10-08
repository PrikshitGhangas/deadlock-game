/**
 * tutor.js — offline, zero-cost "AI tutor".
 *
 * A small natural-language front end over the simulation data: the question is
 * normalised, entities (transactions, resources, processes, step numbers) are
 * extracted, an intent is matched from a pattern table, and a resolver builds
 * the answer from the actual step data. "What if" questions re-run the engine.
 * No network, no API keys.
 */
import { parseSchedule } from './parser.js';
import { simulateDetection } from './detection.js';
import { simulatePrevention } from './prevention.js';

export const GLOSSARY = {
  deadlock: 'A deadlock is a situation where a set of transactions each wait for a lock held by another member of the set, so none of them can ever proceed. In lock-based systems it corresponds exactly to a cycle in the wait-for graph.',
  'wait-for graph': 'The wait-for graph (WFG) has one node per transaction and an edge Ti → Tj whenever Ti is waiting for a data item locked by Tj. Deadlock detection = finding a cycle in this graph (O(V+E) with depth-first search).',
  'two-phase locking': 'Two-phase locking (2PL) requires every transaction to acquire all its locks (growing phase) before releasing any (shrinking phase). It guarantees serialisability but not freedom from deadlock. Strict 2PL holds all locks until commit.',
  'shared lock': 'A shared (S) lock lets a transaction read an item. Many transactions can hold S locks on the same item simultaneously, but an S lock conflicts with an exclusive lock.',
  'exclusive lock': 'An exclusive (X) lock is needed to write an item. Only one transaction may hold it, and it conflicts with every other lock (S or X) on that item.',
  'lock upgrade': 'Upgrading converts a shared lock to an exclusive one. If two transactions both hold S on the same item and both try to upgrade, each waits for the other — a classic deadlock. SELECT … FOR UPDATE avoids this by taking the X lock early.',
  'wait-die': 'Wait-die is a non-preemptive timestamp scheme: when Ti requests a lock held by Tj, Ti waits only if it is older than Tj; a younger requester is aborted ("dies") and restarted with its original timestamp. Waits go only from old to young, so no cycle can form.',
  'wound-wait': 'Wound-wait is a preemptive timestamp scheme: an older requester "wounds" (aborts) a younger holder and takes the lock; a younger requester waits for an older holder. Waits go only from young to old, so no cycle can form.',
  timestamp: 'Each transaction receives a timestamp when it starts (here, its order of first appearance). Smaller timestamp = older. Prevention schemes compare timestamps to decide who waits and who aborts; restarted transactions keep their timestamp to avoid starvation.',
  "banker's algorithm": "The Banker's algorithm avoids deadlock by only granting a resource request if the resulting state is safe — i.e. there exists an order (safe sequence) in which every process can obtain its maximum demand and finish. Safety check costs O(n²·m).",
  'safe state': 'A state is safe if there is a sequence of all processes such that each one\'s remaining need can be satisfied by the currently available resources plus those released by the processes before it. Safe ⇒ no deadlock possible. Unsafe ≠ deadlocked, but deadlock becomes possible.',
  'coffman conditions': 'Deadlock requires all four Coffman conditions: (1) mutual exclusion, (2) hold and wait, (3) no preemption, (4) circular wait. Prevention schemes break one of them — wound-wait breaks "no preemption", wait-die breaks "hold and wait", Banker\'s avoids circular wait by staying in safe states.',
  victim: 'When a deadlock is detected, one transaction in the cycle is chosen as the victim and rolled back to break the cycle. Common policies: youngest (least work lost), fewest locks held, or the transaction that closed the cycle. Real systems (e.g. SQL Server) use the estimated rollback cost.',
  rollback: 'Rollback undoes all of a transaction\'s changes and releases its locks. After rollback the transaction is restarted from its first operation; other transactions waiting on its locks wake up.',
  starvation: 'Starvation (livelock) happens when a transaction is repeatedly chosen as the victim or repeatedly aborted and never finishes. Keeping the original timestamp on restart (wait-die / wound-wait) and counting rollbacks in victim selection prevent it.',
  detection: 'Deadlock detection lets deadlocks happen, periodically (or on every wait) searches the wait-for graph for a cycle, then rolls back a victim. Used by MySQL InnoDB, PostgreSQL (after deadlock_timeout) and SQL Server.',
  prevention: 'Deadlock prevention orders lock requests so a cycle can never form — e.g. timestamp schemes (wait-die, wound-wait) or acquiring locks in a global order. It never needs detection but may abort transactions unnecessarily.',
  avoidance: "Deadlock avoidance (Banker's algorithm) requires each process to declare its maximum demand in advance and grants only requests that keep the system in a safe state. Rarely used in DBMSs because transactions don't know their future locks.",
};

const GLOSSARY_ALIASES = {
  wfg: 'wait-for graph', 'wait for graph': 'wait-for graph', 'waits-for graph': 'wait-for graph',
  '2pl': 'two-phase locking', 'two phase locking': 'two-phase locking', 'strict 2pl': 'two-phase locking',
  's lock': 'shared lock', 'x lock': 'exclusive lock', 'upgrade': 'lock upgrade',
  'wait die': 'wait-die', 'wound wait': 'wound-wait', bankers: "banker's algorithm", banker: "banker's algorithm", "banker's": "banker's algorithm",
  'safe sequence': 'safe state', 'unsafe state': 'safe state', coffman: 'coffman conditions', 'circular wait': 'coffman conditions',
  livelock: 'starvation', abort: 'rollback',
};

const norm = (s) => String(s || '').toLowerCase().replace(/[?!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();

function extractEntities(q, ctx) {
  const txns = [...q.matchAll(/\bt(\d+)\b/g)].map((m) => `T${m[1]}`);
  const procs = [...q.matchAll(/\bp(\d+)\b/g)].map((m) => Number(m[1]));
  const stepM = /\bstep (\d+)\b/.exec(q);
  const known = new Set((ctx.resources || []).map((r) => r.toLowerCase()));
  const resources = q.split(' ').filter((w) => known.has(w)).map((w) => w.toUpperCase());
  return { txns, procs, step: stepM ? Number(stepM[1]) : null, resources };
}

const stepsOf = (ctx) => ctx.result?.steps || ctx.steps || [];
const fmtCycle = (c) => c.join(' → ');
const ref = (i) => `[step ${i + 1}]`;

/* ---------- resolvers (one per intent) ---------- */

const R = {
  cycle(ctx) {
    const steps = stepsOf(ctx);
    if (ctx.mode === 'bankers') return R.safeSequence(ctx);
    const dl = steps.filter((s) => s.event === 'DEADLOCK_DETECTED' || (s.event === 'GAME_MOVE' && s.meta.kind === 'deadlock'));
    if (dl.length === 0) {
      const waits = steps.filter((s) => s.event === 'BLOCK' || s.event === 'WAIT').length;
      return {
        answer: `No deadlock occurred in this run. The wait-for graph never contained a cycle${waits ? ` — there were ${waits} wait${waits > 1 ? 's' : ''}, but each was an ordinary acyclic wait that resolved when the holder released its lock` : ' — every lock request was granted immediately'}.${ctx.mode === 'prevention' ? ` That is guaranteed by ${ctx.result?.options?.scheme}: waits are only allowed in one direction of the timestamp order.` : ''}`,
      };
    }
    const first = dl[0];
    return {
      answer: `Yes. ${dl.length === 1 ? 'A deadlock' : `${dl.length} deadlocks`} occurred. The first one was detected at ${ref(first.index)}: the DFS found the cycle ${fmtCycle(first.cycle)}. Each transaction in that cycle holds a lock the next one needs, so none can proceed without intervention.`,
      stepRef: first.index,
    };
  },

  whyVictim(ctx, ent) {
    const steps = stepsOf(ctx);
    const target = ent.txns[0];
    const cands = steps.filter((s) => ['VICTIM', 'DIE', 'WOUND'].includes(s.event) && (!target || s.txn === target || (s.event === 'WOUND' && String(s.meta.victim).includes(target))));
    if (cands.length === 0) {
      if (target) return { answer: `${target} was never aborted or rolled back in this run.` };
      return { answer: 'No transaction was aborted or rolled back in this run.' };
    }
    const s = cands[0];
    if (s.event === 'VICTIM') {
      return { answer: `${s.txn} was chosen as the victim at ${ref(s.index)} using the "${s.meta.policyLabel}" policy: ${s.meta.reason}. It was part of the cycle ${fmtCycle(s.meta.cycle)}; rolling it back released ${s.meta.released.map((r) => `${r.mode}(${r.res})`).join(', ')} and broke the cycle. It restarted later from its first operation.`, stepRef: s.index };
    }
    if (s.event === 'DIE') {
      return { answer: `${s.txn} died at ${ref(s.index)}. Under wait-die a younger transaction may not wait for an older one: ${s.txn} (TS=${s.meta.tsReq}) requested ${s.op.res}, held by older ${s.meta.holder} (TS=${s.meta.tsHolder}), so it was aborted and restarted with the same timestamp.`, stepRef: s.index };
    }
    return { answer: `${s.meta.victim} was wounded at ${ref(s.index)}. Under wound-wait an older transaction preempts a younger holder: ${s.txn} (TS=${s.meta.tsReq}) needed ${s.op.res}, held by younger ${s.meta.victim} (TS=${s.meta.tsHolder}), so ${s.meta.victim} was aborted and ${s.txn} took the lock.`, stepRef: s.index };
  },

  waitingFor(ctx, ent) {
    const steps = stepsOf(ctx);
    const i = ctx.currentStep ?? steps.length - 1;
    const s = steps[i];
    if (!s || !s.wfg) return { answer: 'Run a simulation first, then I can tell you who is waiting for whom.' };
    const t = ent.txns[0];
    const edges = s.wfg.edges.filter((e) => !t || e.from === t);
    if (edges.length === 0) return { answer: t ? `${t} is not waiting for anyone at ${ref(i)}${s.statuses?.[t] ? ` (status: ${s.statuses[t]})` : ''}.` : `Nobody is waiting at ${ref(i)}; the wait-for graph has no edges.` };
    return { answer: `At ${ref(i)}: ` + edges.map((e) => `${e.from} waits for ${e.to} (needs ${e.res})`).join('; ') + '.', stepRef: i };
  },

  holds(ctx, ent) {
    const steps = stepsOf(ctx);
    const i = ctx.currentStep ?? steps.length - 1;
    const s = steps[i];
    if (!s?.lockTable) return { answer: 'Run a simulation first.' };
    const t = ent.txns[0];
    const out = [];
    for (const [res, e] of Object.entries(s.lockTable)) {
      for (const h of e.holders) if (!t || h.txn === t) out.push(`${h.txn} holds ${h.mode}(${res})`);
    }
    if (!out.length) return { answer: t ? `${t} holds no locks at ${ref(i)}.` : `No locks are held at ${ref(i)}.` };
    return { answer: `At ${ref(i)}: ${out.join('; ')}.`, stepRef: i };
  },

  explainStep(ctx, ent) {
    const steps = stepsOf(ctx);
    const n = ent.step ?? (ctx.currentStep != null ? ctx.currentStep + 1 : null);
    if (!n || n < 1 || n > steps.length) return { answer: `There are ${steps.length} steps; ask about a step between 1 and ${steps.length}.` };
    const s = steps[n - 1];
    return { answer: `Step ${n} — ${s.explanation.title}. ${s.explanation.text} Why it matters: ${s.explanation.why}`, stepRef: n - 1 };
  },

  whatIf(ctx, ent, q) {
    const schedule = ctx.input?.schedule;
    if (!schedule) return { answer: '"What if" comparisons need a lock schedule. Load one in Detection or Prevention mode first.' };
    const p = parseSchedule(schedule);
    if (!p.ok) return { answer: 'The current schedule has validation errors, fix them first.' };
    const runs = {
      detection: () => simulateDetection(p.ops, p.txns, { victimPolicy: /oldest/.test(q) ? 'oldest' : /fewest/.test(q) ? 'fewestLocks' : /closed|requester/.test(q) ? 'requester' : 'youngest' }),
      'wait-die': () => simulatePrevention(p.ops, p.txns, { scheme: 'wait-die' }),
      'wound-wait': () => simulatePrevention(p.ops, p.txns, { scheme: 'wound-wait' }),
    };
    const want = /wound/.test(q) ? 'wound-wait' : /wait.?die/.test(q) ? 'wait-die' : /detect|victim|oldest|fewest|youngest/.test(q) ? 'detection' : null;
    const describe = (r) => {
      const aborted = r.steps.filter((s) => ['VICTIM', 'DIE'].includes(s.event)).map((s) => s.txn).concat(r.steps.filter((s) => s.event === 'WOUND').map((s) => s.meta.victim));
      return `${r.summary.deadlocks} deadlock(s), ${r.summary.rollbacks} rollback(s)${aborted.length ? ` (aborted: ${[...new Set(aborted)].join(', ')})` : ''}, ${r.steps.length} steps, committed ${r.summary.committed.join(', ') || 'nobody'}`;
    };
    if (want) {
      const r = runs[want]();
      const label = want === 'detection' ? `detection with victim policy "${r.options.victimPolicy}"` : want;
      return { answer: `Under ${label} this schedule gives: ${describe(r)}. Switch the mode/scheme selector in the input panel to step through it.` };
    }
    const all = Object.entries(runs).map(([k, f]) => `• ${k}: ${describe(f())}`).join('\n');
    return { answer: `Comparing all strategies on the current schedule:\n${all}` };
  },

  safeSequence(ctx) {
    const sum = ctx.result?.summary;
    if (ctx.mode !== 'bankers' || !sum) return { answer: "Safe sequences belong to the Banker's algorithm. Switch to the Banker's tab and run a scenario." };
    const steps = stepsOf(ctx);
    const s = steps.find((x) => x.event === 'BANKER_SAFE' || x.event === 'BANKER_UNSAFE');
    if (sum.safe) return { answer: `The initial state is SAFE. Safe sequence: ⟨${sum.sequence.map((p) => 'P' + p).join(', ')}⟩. Each process in that order has Need ≤ Work, then returns its allocation to Work.`, stepRef: s?.index };
    return { answer: 'The initial state is UNSAFE: at some point no unfinished process has Need ≤ Work, so the Banker cannot guarantee all of them finish.', stepRef: s?.index };
  },

  whyDenied(ctx) {
    const req = ctx.result?.summary?.request;
    if (!req) return { answer: 'No resource request was made in this run. Fill in the Request row (process and vector) and run again.' };
    const steps = stepsOf(ctx);
    const s = steps.find((x) => ['BANKER_GRANT', 'BANKER_DENY'].includes(x.event) || (x.event === 'BANKER_REQUEST' && x.meta.verdict !== 'tentative'));
    const why = { 'exceeds-need': 'it exceeds the process\'s declared remaining Need — an error in the request', 'exceeds-available': 'it exceeds what is currently Available, so the process must wait', unsafe: 'granting it would leave the system in an unsafe state (no safe sequence exists)', safe: 'it is within Need, within Available, and the resulting state is still safe' }[req.reason];
    return { answer: `P${req.pid}'s request [${String(req.vector).replace(/\s+/g, ', ')}] was ${req.granted ? 'GRANTED' : 'DENIED'} because ${why}.`, stepRef: s?.index };
  },

  howAvoid(ctx) {
    const steps = stepsOf(ctx);
    const dl = steps.find((s) => s.event === 'DEADLOCK_DETECTED' || (s.event === 'GAME_MOVE' && s.meta.kind === 'deadlock'));
    const generic = 'General techniques: (1) acquire locks in a fixed global order in every transaction, (2) use a prevention scheme such as wait-die or wound-wait, (3) take the strongest lock you will need up front (SELECT … FOR UPDATE) to avoid upgrade deadlocks, (4) keep transactions short so locks are held briefly.';
    if (!dl) return { answer: `There is no deadlock in this run. ${generic}` };
    const cyc = dl.cycle;
    return { answer: `The cycle ${fmtCycle(cyc)} formed because the transactions acquired the same items in different orders. Reordering the schedule so that ${cyc[0]} finishes (commits) before ${cyc[1]} requests its first conflicting item removes the cycle. ${generic}`, stepRef: dl.index };
  },

  summary(ctx) {
    const steps = stepsOf(ctx);
    const sum = ctx.result?.summary;
    if (!steps.length || !sum) return { answer: 'Nothing has been simulated yet. Pick a sample or type a schedule and press Run.' };
    if (ctx.mode === 'bankers') return R.safeSequence(ctx);
    const dl = steps.filter((s) => s.event === 'DEADLOCK_DETECTED').length;
    const ab = steps.filter((s) => ['VICTIM', 'DIE', 'WOUND'].includes(s.event)).length;
    return { answer: `This ${ctx.mode} run took ${steps.length} steps. Deadlocks detected: ${dl}. Aborts/rollbacks: ${ab}. Committed: ${sum.committed?.join(', ') || 'none'}.${sum.stuck?.length ? ` Still waiting at the end: ${sum.stuck.join(', ')}.` : ''} Use ← → to walk through the steps; each one has an explanation.` };
  },

  define(ctx, ent, q) {
    const key = Object.keys(GLOSSARY).find((k) => q.includes(k)) || Object.keys(GLOSSARY_ALIASES).find((k) => q.includes(k));
    const term = GLOSSARY[key] ? key : GLOSSARY_ALIASES[key];
    if (!term) return null;
    return { answer: `${term[0].toUpperCase() + term.slice(1)}: ${GLOSSARY[term]}` };
  },

  hint(ctx) {
    if (ctx.mode !== 'game') return { answer: 'Hints are available in Game mode — press the Hint button on the board to see which moves are safe.' };
    return { answer: ctx.levelTip ? `Level tip: ${ctx.levelTip} Press Hint (−10 points) to see exactly which moves keep a win reachable.` : 'Press the Hint button (−10 points) to see which moves keep a win reachable.' };
  },
};

/* ---------- intent table (order matters: first match wins) ---------- */

const INTENTS = [
  { name: 'explainStep', re: /\b(explain|what happen(ed|s)|describe|show)\b.*\bstep \d+|^step \d+/ },
  { name: 'whatIf', re: /\bwhat if\b|\binstead\b|\bcompare\b|\bunder (wait.?die|wound.?wait|detection)\b|\bwould .*(wait.?die|wound.?wait)/ },
  { name: 'whyVictim', re: /\b(why|how come)\b.*\b(victim|abort|rolled back|roll back|rollback|die|died|wound|wounded|chosen|restart)/ },
  { name: 'whyVictim', re: /\b(who|which)\b.*\b(victim|aborted|rolled back|died|wounded)\b/ },
  { name: 'whyDenied', re: /\b(why|was|is)\b.*\b(denied|granted|rejected|refused|request)\b/ },
  { name: 'safeSequence', re: /\b(the|current|this) safe (sequence|state)\b|\bis (the |this )?(state|system) safe\b|\bunsafe\b|^safe sequence/ },
  // definitional questions ("what is a wait-for graph?") must beat the state questions below
  { name: 'define', re: /^(what is|what's|whats|what are|define|definition of|explain|meaning of|tell me about|describe)\b(?! step)/ },
  { name: 'waitingFor', re: /\b(waiting|wait|blocked|block)\b/ },
  { name: 'holds', re: /\b(hold|holds|holding|has|have|own|owns)\b.*\b(lock|locks)\b|\bwhich locks\b/ },
  { name: 'cycle', re: /\b(is|was|are|any|does|did|there)\b.*\b(deadlock|cycle)\b|\bdeadlock\?|\bcycle\?/ },
  { name: 'howAvoid', re: /\b(avoid|prevent|fix|solve|resolve|break)\b/ },
  { name: 'hint', re: /\bhint\b|\bwhat should i\b|\bnext move\b|\bwhich (transaction|move)\b/ },
  { name: 'summary', re: /\bsummar|\boverview\b|\bwhat happened\b|\brecap\b|\bresult\b/ },
];

/**
 * @param {string} question
 * @param {{mode:string, result?:object, steps?:object[], currentStep?:number, input?:object, resources?:string[], levelTip?:string}} ctx
 * @returns {{answer:string, intent:string, stepRef?:number, suggestions:string[]}}
 */
export function answer(question, ctx) {
  const q = norm(question);
  const ent = extractEntities(q, ctx);
  let intent = 'fallback';
  let out = null;
  for (const it of INTENTS) {
    if (it.re.test(q)) {
      out = R[it.name](ctx, ent, q);
      if (out) { intent = it.name; break; }
    }
  }
  if (!out) {
    // last try: glossary term mentioned anywhere
    out = R.define(ctx, ent, q);
    if (out) intent = 'define';
  }
  if (!out) {
    out = {
      answer: 'I can answer questions about the current run — for example who is waiting for whom, why a transaction was aborted, whether there is a cycle, what a step means, or what would happen under another strategy. I can also define terms such as "wait-for graph" or "wound-wait". Try one of the suggested questions below.',
    };
  }
  return { ...out, intent, suggestions: suggestedQuestions(ctx, intent) };
}

/** Context-sensitive clickable questions. */
export function suggestedQuestions(ctx, lastIntent = null) {
  const steps = stepsOf(ctx);
  const base = [];
  if (ctx.mode === 'bankers') {
    base.push('What is the safe sequence?', 'Why was the request denied?', 'What is a safe state?', "Explain the Banker's algorithm");
  } else if (ctx.mode === 'game') {
    base.push('Give me a hint', 'Who is waiting for whom?', 'What is a deadlock?', 'How do I avoid this deadlock?');
  } else {
    const dl = steps.find((s) => s.event === 'DEADLOCK_DETECTED');
    const vic = steps.find((s) => ['VICTIM', 'DIE', 'WOUND'].includes(s.event));
    base.push('Is there a deadlock?');
    if (vic) base.push(`Why was ${vic.event === 'WOUND' ? vic.meta.victim : vic.txn} aborted?`);
    base.push('Who is waiting for whom?');
    if (dl) base.push('How can I avoid this deadlock?');
    base.push(ctx.mode === 'prevention' ? 'What if I used detection instead?' : 'What if I used wound-wait instead?');
    if (steps.length > 2) base.push(`Explain step ${Math.min(3, steps.length)}`);
    base.push('What is a wait-for graph?');
  }
  return base.filter((s, i, a) => a.indexOf(s) === i).slice(0, 6);
}

/**
 * Plain-text summary of the current run for the optional LLM tutor.
 * Keeps the prompt small: input, options, summary, step titles, and full detail for the current step.
 */
export function summarizeForAi(ctx) {
  const steps = stepsOf(ctx);
  const lines = [`Mode: ${ctx.mode}`];
  if (ctx.input?.schedule) lines.push('Schedule (one op per line):', ctx.input.schedule);
  if (ctx.input?.victimPolicy) lines.push(`Victim policy: ${ctx.input.victimPolicy}`);
  if (ctx.input?.scheme) lines.push(`Prevention scheme: ${ctx.input.scheme}`);
  if (ctx.input?.available) {
    lines.push(`Available: ${ctx.input.available}`, `Max:\n${ctx.input.max}`, `Allocation:\n${ctx.input.allocation}`);
    if (ctx.input.request?.vector) lines.push(`Request: P${ctx.input.request.pid} -> ${ctx.input.request.vector}`);
  }
  if (ctx.levelTip) lines.push(`Game level tip: ${ctx.levelTip}`);
  const sum = ctx.result?.summary;
  if (sum) lines.push(`Summary: ${JSON.stringify(sum)}`);
  if (steps.length) {
    lines.push(`Steps (${steps.length}):`);
    steps.forEach((s) => lines.push(`${s.index + 1}. [${s.event}] ${s.explanation?.title || ''}`));
    const i = ctx.currentStep ?? steps.length - 1;
    const cur = steps[i];
    if (cur) {
      lines.push(`\nStudent is currently viewing step ${i + 1}: ${cur.explanation?.title}`);
      lines.push(cur.explanation?.text || '');
      if (cur.lockTable) {
        lines.push('Lock table at this step:');
        for (const [res, e] of Object.entries(cur.lockTable)) {
          lines.push(`  ${res}: held by ${e.holders.map((h) => `${h.txn}(${h.mode})`).join(', ') || 'nobody'}; waiting: ${e.queue.map((q) => `${q.txn}(${q.mode})`).join(', ') || 'none'}`);
        }
      }
      if (cur.wfg?.edges?.length) lines.push(`Wait-for edges: ${cur.wfg.edges.map((e) => `${e.from}->${e.to} (${e.res})`).join(', ')}`);
      if (cur.cycle) lines.push(`Cycle: ${cur.cycle.join(' -> ')}`);
      if (cur.state) lines.push(`Work: [${(cur.state.work || cur.state.available).join(', ')}] Finish: [${(cur.state.finish || []).map((f) => (f ? 'T' : 'F')).join(',')}] Need: ${JSON.stringify(cur.state.need)}`);
    }
  } else {
    lines.push('No simulation has been run yet.');
  }
  return lines.join('\n');
}
