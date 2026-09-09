// ALMOST CHOSEN — Public Projection / Live Archive.
// Anonymized aggregate view synchronized with the participant page via
// the shared archive store (localStorage + BroadcastChannel).
// STRICT ANONYMITY: never renders wish text, fragments, identifying content,
// or an individual category paired with a specific ticket entry. The recent
// feed shows Ticket ID + Result + Generated Time only.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useP5Ready } from '@/hooks/useP5';
import {
  CATEGORY_ACCENT,
  MAX_DISTANCE,
  OUTCOME_BANDS,
  PALETTE,
  PROJECTED_CATEGORIES,
  accentFor,
  formatDate,
  formatTime,
  type Category,
  type Outcome,
} from '@/lib/engine';
import {
  archiveStore,
  computeCategoryCounts,
  computeOutcomeCounts,
  latestTestRecord,
  recentRecords,
  uptimeLabel,
  type ArchiveState,
} from '@/lib/archive';
import { getIncludeTestRecords } from '@/lib/adminConfig';
import type { P5Instance } from '@/lib/ticket';
import AdminPanel from '@/components/AdminPanel';

const CATEGORY_COLORS = CATEGORY_ACCENT;

export default function Projection() {
  const p5Ready = useP5Ready();
  const [state, setState] = useState<ArchiveState>(archiveStore.getState());
  const [now, setNow] = useState(Date.now());
  const vizHost = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<{ remove: () => void } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => archiveStore.subscribe(setState), []);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  const includeTest = useMemo(() => getIncludeTestRecords(), [state]);
  const outcomeCounts = useMemo(() => computeOutcomeCounts(state, includeTest), [state, includeTest]);
  const categoryCounts = useMemo(() => computeCategoryCounts(state, PROJECTED_CATEGORIES, includeTest), [state, includeTest]);
  const recent = useMemo(() => recentRecords(state, 6, includeTest), [state, includeTest]);
  const testEvent = useMemo(() => { const t = latestTestRecord(state); return t && t.result === 'CHOSEN' ? t : null; }, [state]);
  const latest = recent[0];
  const maxCat = Math.max(1, ...categoryCounts.map((c) => c.count));

  useEffect(() => {
    if (!p5Ready || !vizHost.current) return;
    const P5Ctor = (window as unknown as { p5?: new (...a: unknown[]) => unknown }).p5;
    if (!P5Ctor) return;
    const host = vizHost.current;
    host.innerHTML = '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sketch = new (P5Ctor as any)((p: P5Instance & Record<string, any>) => {
      let W = 600; let H = 600; let lastTicketId: string | null = null; let pulseAt = 0;
      const angleFor = (id: string): number => {
        let h = 2166136261;
        for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
        return ((h >>> 0) % 3600) / 3600 * Math.PI * 2;
      };

      p.setup = () => {
        const rect = host.getBoundingClientRect(); W = Math.max(320, rect.width); H = Math.max(320, rect.height);
        const cnv = p.createCanvas(W, H); cnv.parent(host);
      };
      p.windowResized = () => { const rect = host.getBoundingClientRect(); W = Math.max(320, rect.width); H = Math.max(320, rect.height); p.resizeCanvas(W, H); };
      p.draw = () => {
        p.clear();
        const cx = W / 2; const cy = H / 2; const t = p.frameCount; const records = stateRef.current.records; const total = records.length; const now = Date.now(); const arm = Math.min(W, H) / 2 - 24; const rMin = 26; const rMax = arm - 8;
        p.noFill();
        for (const b of OUTCOME_BANDS) { const rr = rMin + (b.maxDistance / MAX_DISTANCE) * (rMax - rMin); const rgb = hexToRgb(b.accent); p.stroke(rgb.r, rgb.g, rgb.b, 40); p.strokeWeight(1); p.circle(cx, cy, rr * 2); }
        p.push(); p.translate(cx, cy); p.rotate(t * 0.0015); p.stroke(255, 255, 255, 18); p.strokeWeight(1); p.line(-arm, 0, arm, 0); p.line(0, -arm, 0, arm); p.pop();

        const WINDOW = 600; const slice = total > WINDOW ? records.slice(total - WINDOW) : records;
        for (let i = 0; i < slice.length; i++) {
          const rec = slice[i]; const angle = angleFor(rec.ticketId); const distNorm = Math.min(1, rec.distance / MAX_DISTANCE); const radius = rMin + distNorm * (rMax - rMin); const wob = Math.sin(t * 0.006 + i) * 3; const x = cx + Math.cos(angle) * (radius + wob); const y = cy + Math.sin(angle) * (radius + wob);
          const ageMs = now - rec.generatedAt; const fresh = Math.max(0, 1 - ageMs / (1000 * 60 * 5)); const size = 3 + fresh * 6; const catRgb = hexToRgb(CATEGORY_ACCENT[rec.category as Category] ?? PALETTE.white); const alpha = 90 + fresh * 150;
          p.noStroke(); p.fill(catRgb.r, catRgb.g, catRgb.b, alpha); p.circle(x, y, size);
          const outRgb = hexToRgb(accentFor(rec.result)); p.noFill(); p.stroke(outRgb.r, outRgb.g, outRgb.b, 120 + fresh * 120); p.strokeWeight(1.2 + fresh * 1.4); p.circle(x, y, size + 5 + fresh * 4);
        }

        const newest = slice[slice.length - 1];
        if (newest && newest.ticketId !== lastTicketId) { lastTicketId = newest.ticketId; pulseAt = t; }
        if (newest) {
          const age = t - pulseAt;
          if (age < 60) { const angle = angleFor(newest.ticketId); const distNorm = Math.min(1, newest.distance / MAX_DISTANCE); const radius = rMin + distNorm * (rMax - rMin); const x = cx + Math.cos(angle) * radius; const y = cy + Math.sin(angle) * radius; const outRgb = hexToRgb(accentFor(newest.result)); const prog = age / 60; p.noFill(); p.stroke(outRgb.r, outRgb.g, outRgb.b, (1 - prog) * 200); p.strokeWeight(2); p.circle(x, y, 10 + prog * 60); }
        }

        const pulse = 1 + Math.sin(t * 0.05) * 0.12; const coreRgb = hexToRgb(PALETTE.yellow);
        p.push(); p.translate(cx, cy); p.rotate(t * 0.01); p.noStroke(); p.fill(coreRgb.r, coreRgb.g, coreRgb.b, 235); const s = 12 * pulse + Math.min(10, total * 0.15); p.triangle(0, -s, -s * 0.28, 0, s * 0.28, 0); p.triangle(0, s, -s * 0.28, 0, s * 0.28, 0); p.triangle(-s, 0, 0, -s * 0.28, 0, s * 0.28); p.triangle(s, 0, 0, -s * 0.28, 0, s * 0.28); p.pop();
        p.push(); p.translate(cx, cy); for (let i = 0; i < 60; i++) { p.rotate((Math.PI * 2) / 60); p.stroke(255, 255, 255, i % 5 === 0 ? 60 : 20); p.strokeWeight(1); p.line(0, -arm, 0, -arm + (i % 5 === 0 ? 12 : 6)); } p.pop();
        if (total === 0) { p.noStroke(); p.fill(255, 255, 255, 90); p.textAlign(p.CENTER, p.CENTER); p.textSize(12); p.text('AWAITING FIRST ARCHIVE RECORD', cx, cy + arm - 6); }
      };
    }, host);

    sketchRef.current = sketch as { remove: () => void };
    return () => { try { sketchRef.current?.remove(); } catch { /* noop */ } host.innerHTML = ''; };
  }, [p5Ready]);

  return (
    <div className="relative min-h-screen w-full bg-black font-mono text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize: '30px 30px' }} />
      <div className="relative z-10 px-6 py-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/15 pb-4">
          <div className="flex items-center gap-3"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PALETTE.white }} /><div><h1 className="text-lg font-bold leading-none tracking-[0.35em] text-white">ALMOST CHOSEN</h1><p className="mt-2 text-[11px] tracking-[0.4em]" style={{ color: PALETTE.cyan }}>PUBLIC PROJECTION / LIVE ARCHIVE</p></div></div>
          <div className="flex items-center gap-6 text-right"><div><div className="text-[10px] tracking-[0.3em] text-white/50">SYSTEM STATUS</div><div className="flex items-center gap-2 text-sm font-bold" style={{ color: '#3BE38A' }}><span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: '#3BE38A' }} />LIVE</div></div><div><div className="text-[10px] tracking-[0.3em] text-white/50">SYSTEM TIME</div><div className="text-xl font-bold tabular-nums" style={{ color: PALETTE.cyan }}>{formatTime(now)}</div><div className="text-[11px] text-white/60">{formatDate(now)}</div></div><div><div className="text-[10px] tracking-[0.3em] text-white/50">ARCHIVE UPTIME</div><div className="text-sm font-bold text-white/90 tabular-nums">{uptimeLabel(state.launchedAt, now)}</div></div></div>
        </header>

        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 space-y-5 lg:col-span-3">
            <Panel label="TOTAL WISHES SUBMITTED" accent={PALETTE.blue}><div className="text-5xl font-black tabular-nums" style={{ color: PALETTE.blue }}>{outcomeCounts.total.toLocaleString()}</div><div className="mt-1 text-[10px] tracking-[0.25em] text-white/40">SINCE ARCHIVE LAUNCH · {formatDate(state.launchedAt)}</div></Panel>
            <Panel label="OBSERVED RESULTS · ACTUAL ARCHIVE" accent={PALETTE.pink}><div className="space-y-3">{OUTCOME_BANDS.map((b) => { const pct = outcomeCounts.percentages[b.outcome as Outcome]; const cnt = outcomeCounts.counts[b.outcome as Outcome]; return <div key={b.outcome}><div className="mb-1 flex items-center justify-between text-[11px] tracking-[0.15em]"><span style={{ color: b.accent }}>{b.outcome}</span><span className="tabular-nums text-white/70">{pct}% · {cnt}</span></div><div className="h-2 w-full bg-white/10"><div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: b.accent }} /></div></div>; })}</div></Panel>
            <Panel label="DECLARED SYSTEM ODDS · FIXED" accent={PALETTE.yellow}><div className="space-y-2">{OUTCOME_BANDS.map((b) => <div key={b.outcome} className="flex items-center justify-between text-[11px] tracking-[0.15em]"><span className="flex items-center gap-2"><span className="inline-block h-2 w-4" style={{ backgroundColor: b.accent }} /><span className="text-white/70">{b.outcome}</span></span><span className="font-bold tabular-nums" style={{ color: b.accent }}>{b.percent}%</span></div>)}</div><div className="mt-3 flex h-2 w-full overflow-hidden">{OUTCOME_BANDS.map((b) => <div key={b.outcome} style={{ width: `${b.percent}%`, backgroundColor: b.accent }} />)}</div><div className="mt-1 flex justify-between text-[9px] tracking-[0.2em] text-white/35"><span>LOWER PROXIMITY</span><span>HIGHER PROXIMITY</span></div></Panel>
          </div>

          <div className="order-first col-span-12 lg:order-none lg:col-span-6"><div className="relative flex h-full min-h-[420px] flex-col border border-white/15 p-4 sm:min-h-[520px]"><div className="mb-2 flex items-center justify-between text-[10px] tracking-[0.3em] text-white/45"><span>ARCHIVE FIELD · ONE DOT = ONE ANONYMOUS RECORD</span><span>{outcomeCounts.total} RECORDS</span></div><div ref={vizHost} className="relative w-full flex-1">{!p5Ready && <div className="flex h-full items-center justify-center text-white/40">INITIALIZING FIELD…</div>}</div><div className="mt-2 space-y-1.5 text-[9px] tracking-[0.22em] text-white/45"><div className="flex flex-wrap items-center gap-x-4 gap-y-1"><span>RADIUS = DISTANCE TO SELECTION</span><span>DOT COLOR = CATEGORY</span><span>RING = OUTCOME</span><span>BRIGHTNESS = RECENCY</span></div><div className="flex flex-wrap items-center gap-x-3 gap-y-1">{OUTCOME_BANDS.map((b) => <span key={b.outcome} className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full border" style={{ borderColor: b.accent }} /><span style={{ color: b.accent }}>{b.outcome}</span></span>)}</div></div></div></div>

          <div className="col-span-12 space-y-5 lg:col-span-3">
            {testEvent && <div className="border-2 p-4" style={{ borderColor: PALETTE.yellow, backgroundColor: `${PALETTE.yellow}10` }}><div className="mb-2 flex items-center justify-between"><span className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.28em]" style={{ color: PALETTE.yellow }}><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE.yellow }} />TEST RECORD</span><span className="text-[9px] tracking-[0.2em] text-white/45">NOT IN PUBLIC STATS</span></div><div className="text-lg font-black" style={{ color: accentFor(testEvent.result) }}>{testEvent.result}</div><div className="mt-1 tabular-nums text-sm text-white/80">{testEvent.ticketId}</div><div className="mt-1 text-[11px] tracking-[0.2em] text-white/45">CIRCULAR DISTANCE {testEvent.distance} · {formatTime(testEvent.generatedAt)}</div></div>}
            <Panel label="CATEGORY DISTRIBUTION" accent={PALETTE.orange}><div className="space-y-2">{categoryCounts.map((c) => <div key={c.category}><div className="mb-1 flex items-center justify-between text-[11px] tracking-[0.15em]"><span className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.category] }} /><span className="text-white/75">{c.category}</span></span><span className="tabular-nums text-white/60">{c.count}</span></div><div className="h-1.5 w-full bg-white/10"><div className="h-full transition-all duration-500" style={{ width: `${(c.count / maxCat) * 100}%`, backgroundColor: CATEGORY_COLORS[c.category] }} /></div></div>)}</div></Panel>
            <Panel label="RECENT TICKET IDS · LIVE FEED" accent={PALETTE.cyan}>{recent.length === 0 ? <div className="py-4 text-center text-[11px] tracking-[0.2em] text-white/35">AWAITING FIRST SYSTEM EVENT…</div> : <ul className="space-y-2">{recent.map((r) => <li key={r.ticketId} className="flex items-center justify-between border-b border-white/8 pb-1.5 text-[11px] last:border-0"><span className="tabular-nums text-white/75">{r.ticketId}</span><span className="flex items-center gap-2"><span className="font-bold" style={{ color: accentFor(r.result) }}>{r.result}</span><span className="tabular-nums text-white/40">{formatTime(r.generatedAt)}</span></span></li>)}</ul>}</Panel>
            <Panel label="LATEST PUBLIC EVENT" accent={latest ? accentFor(latest.result) : PALETTE.white}>{latest ? <div><div className="text-lg font-black" style={{ color: accentFor(latest.result) }}>{latest.result}</div><div className="mt-1 tabular-nums text-sm text-white/80">{latest.ticketId}</div><div className="mt-1 text-[11px] tracking-[0.2em] text-white/45">{formatDate(latest.generatedAt)} · {formatTime(latest.generatedAt)}</div></div> : <div className="py-3 text-[11px] tracking-[0.2em] text-white/35">NO EVENTS YET</div>}</Panel>
          </div>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4 text-[10px] tracking-[0.28em] text-white/40"><span>NO REAL PRIZES · SIMULATED OUTCOMES · WISH TEXT IS NEVER SHOWN HERE</span><span>EVERY WISH MATTERS · ALMOSTCHOSEN.LIVE</span><Link to="/" className="border border-white/25 px-3 py-1 text-white/80 hover:border-white/60 hover:text-white">← PARTICIPANT INPUT</Link></footer>
      </div>
      <AdminPanel />
    </div>
  );
}

function Panel({ label, accent, children }: { label: string; accent: string; children: React.ReactNode; }) {
  return <div className="border border-white/15 p-4"><div className="mb-3 flex items-center gap-2 text-[10px] tracking-[0.28em] text-white/55"><span className="inline-block h-2 w-2" style={{ backgroundColor: accent }} />{label}</div>{children}</div>;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
