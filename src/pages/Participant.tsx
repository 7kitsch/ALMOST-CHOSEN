// ALMOST CHOSEN — Participant view (/participant).
// category -> private wish -> four-stage processing animation -> RESULT + full
// detailed A6 TICKET PREVIEW. ONE immutable record per submission drives
// everything. The wish text stays in local state only; the public archive
// receives an anonymised payload with NO wish text.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CATEGORIES,
  CATEGORY_ACCENT,
  OUTCOME_EXPLANATION_LINES,
  PALETTE,
  accentFor,
  categoryAccentFor,
  formatTime,
  outcomeRangeLabel,
  performChosenPreview,
  performDraw,
  performForcedDraw,
  type Category,
  type DrawResult,
} from '@/lib/engine';
import { archiveStore } from '@/lib/archive';
import { sound } from '@/lib/sound';
import { getForceResult } from '@/lib/adminConfig';
import { integration, renderTicketForPrint, toPrivateRecord, toPublicRecord } from '@/lib/ticketRecord';
import { renderTicket } from '@/lib/ticket';
import ProcessingSequence from '@/components/ProcessingSequence';

type Phase = 'input' | 'processing' | 'ready';
type PrintStatus = 'TICKET READY' | 'PRINTING' | 'PRINT JOB SENT' | 'PRINT FAILED';
type RunMode = 'live' | 'preview' | 'test';
const ADMIN_TEST_WISH = 'ADMIN TEST WISH — CHOSEN STATE VERIFICATION. WISH NUMBER EQUALS SYSTEM DRAW · CIRCULAR DISTANCE ZERO.';
const MAX_WISH = 160;

function TicketPreview({ draw, wishText, onGraphics }: { draw: DrawResult; wishText: string; onGraphics: (dataUrl: string) => void; }) {
  const host = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let sketch: { remove: () => void } | null = null;
    const boot = () => {
      const P5 = (window as unknown as { p5?: unknown }).p5 as | (new (fn: (p: unknown) => void, node: HTMLElement) => { remove: () => void }) | undefined;
      const el = host.current;
      if (!P5 || !el) { if (!cancelled) window.setTimeout(boot, 120); return; }
      el.innerHTML = '';
      sketch = new P5((p: unknown) => {
        const pp = p as { createCanvas: (w: number, h: number) => void; noLoop: () => void; noCanvas?: () => void; };
        (pp as unknown as { setup: () => void }).setup = () => {
          try {
            if (pp.noCanvas) pp.noCanvas(); else pp.createCanvas(1, 1);
            pp.noLoop();
            const g = renderTicket(p as never, draw, wishText) as unknown as { elt: HTMLCanvasElement; width: number; height: number; };
            const src = g.elt;
            const scale = 0.36;
            const view = document.createElement('canvas');
            view.width = Math.round(src.width * scale); view.height = Math.round(src.height * scale); view.className = 'block h-auto w-full';
            const ctx = view.getContext('2d');
            if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, view.width, view.height); }
            el.innerHTML = ''; el.appendChild(view); onGraphics(src.toDataURL('image/png')); if (!cancelled) setReady(true);
          } catch (err) {
            el.innerHTML = `<div class="p-4 text-[11px] tracking-widest text-red-400">TICKET RENDER ERROR: ${String((err as Error)?.message ?? err)}</div>`;
          }
        };
      }, el);
    };
    boot();
    return () => { cancelled = true; try { sketch?.remove(); } catch { /* noop */ } if (host.current) host.current.innerHTML = ''; };
  }, [draw.ticketId]);

  return (
    <div className="relative">
      {!ready && <div className="flex h-[560px] items-center justify-center text-[11px] tracking-[0.3em] text-white/40">RENDERING TICKET…</div>}
      <div ref={host} className="mx-auto w-full max-w-[460px] rounded-sm border border-white/15 bg-[#0B0E16] p-3 shadow-[0_0_40px_rgba(0,0,0,0.6)]" />
    </div>
  );
}

export default function Participant() {
  const [phase, setPhase] = useState<Phase>('input');
  const [category, setCategory] = useState<Category>('OTHER');
  const [wish, setWish] = useState('');
  const [draw, setDraw] = useState<DrawResult | null>(null);
  const wishRef = useRef('');
  const cueRef = useRef<string | null>(null);
  const ticketPngRef = useRef<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [printStatus, setPrintStatus] = useState<PrintStatus>('TICKET READY');
  const [runMode, setRunMode] = useState<RunMode>('live');
  const runModeRef = useRef<RunMode>('live');
  runModeRef.current = runMode;

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preview = params.get('admin_preview'); const test = params.get('admin_test');
    if (preview !== 'chosen' && test !== 'chosen') return;
    const mode: RunMode = test === 'chosen' ? 'test' : 'preview';
    const result = performChosenPreview('FREEDOM', mode === 'test');
    setRunMode(mode); runModeRef.current = mode; setCategory('FREEDOM'); wishRef.current = ADMIN_TEST_WISH; setWish(ADMIN_TEST_WISH); cueRef.current = null; ticketPngRef.current = null; sound.submit(); setDraw(result); sound.startProcessingSequence(); setPhase('processing');
  }, []);

  const accent = categoryAccentFor(category);
  const start = useCallback(() => {
    const trimmed = wish.trim().slice(0, MAX_WISH); if (!trimmed) return;
    sound.submit(); wishRef.current = trimmed; cueRef.current = null; ticketPngRef.current = null;
    const forced = getForceResult(); const result = forced ? performForcedDraw(category, forced) : performDraw(category);
    setDraw(result); sound.startProcessingSequence(); setPhase('processing');
  }, [wish, category]);

  const handleComplete = useCallback(() => {
    if (!draw) return;
    const mode = runModeRef.current; const stamped: DrawResult = { ...draw, generatedAt: Date.now() }; setDraw(stamped);
    if (cueRef.current !== stamped.ticketId) { cueRef.current = stamped.ticketId; sound.outcome(stamped.outcome); }
    if (mode === 'preview') { setPrintStatus('TICKET READY'); setPhase('ready'); return; }
    const priv = toPrivateRecord(stamped, wishRef.current); integration.emit('TICKET_RECORD_CREATED', priv);
    const pub = toPublicRecord(priv);
    archiveStore.recordPublic({ ticketId: pub.ticketId, category: pub.category, result: pub.result, wishNumber: pub.wishNumber, systemDraw: pub.systemDraw, circularDistance: pub.circularDistance, generatedAt: pub.generatedAt, ...(pub.isTest ? { isTest: true } : {}) });
    integration.emit('PUBLIC_RECORD_READY', pub); renderTicketForPrint(priv); setPrintStatus('TICKET READY'); setPhase('ready');
  }, [draw]);

  const reset = useCallback(() => {
    sound.stopAll(); setDraw(null); setWish(''); wishRef.current = ''; cueRef.current = null; ticketPngRef.current = null; setCategory('OTHER'); setPrintStatus('TICKET READY'); setPhase('input'); setRunMode('live'); runModeRef.current = 'live';
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    integration.emit('RESET_COMPLETE', { at: Date.now() });
  }, []);

  const saveTicket = useCallback(() => { const url = ticketPngRef.current; if (!url || !draw) return; const a = document.createElement('a'); a.href = url; a.download = `wish-ticket-${draw.ticketId}.png`; a.click(); }, [draw]);
  const printTicket = useCallback(() => {
    if (runModeRef.current === 'preview') return; const url = ticketPngRef.current; if (!url) return; setPrintStatus('PRINTING');
    const w = window.open('', '_blank', 'width=480,height=680'); if (!w) { setPrintStatus('PRINT FAILED'); sound.printFailed(); return; }
    w.document.write(`<!doctype html><html><head><title>WISH LOTTERY TICKET</title><style>@page{size:105mm 148mm;margin:0}html,body{margin:0;padding:0;background:#fff}img{width:105mm;height:148mm;display:block}</style></head><body><img src="${url}" onload="setTimeout(function(){window.focus();window.print();},120)"/></body></html>`);
    w.document.close(); setPrintStatus('PRINT JOB SENT'); sound.printSent(); integration.emit('TICKET_RENDER_READY', { ticketId: draw?.ticketId ?? null });
  }, [draw]);

  const statusColor = printStatus === 'PRINT FAILED' ? PALETTE.orange : printStatus === 'PRINT JOB SENT' ? PALETTE.cyan : PALETTE.white;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-black font-mono text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)', backgroundSize: '26px 26px' }} />
      <div className="relative z-10 mx-auto max-w-3xl px-5 py-8">
        <header className="mb-8 flex items-start justify-between gap-4 border-b border-white/15 pb-5">
          <div className="flex items-center gap-3"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} /><div><h1 className="text-base font-bold leading-none tracking-[0.35em]">ALMOST CHOSEN<span className="ml-2 text-[10px] tracking-[0.3em] text-white/40">SYSTEM</span></h1><p className="mt-2 text-[11px] tracking-[0.4em]" style={{ color: PALETTE.yellow }}>WISH LOTTERY · PARTICIPANT</p></div></div>
          <div className="text-right"><div className="text-[10px] tracking-[0.3em] text-white/50">SYSTEM TIME</div><div className="text-lg font-bold tabular-nums" style={{ color: PALETTE.cyan }}>{formatTime(now)}</div></div>
        </header>

        {phase === 'input' && <div>
          <div className="mb-3 text-[11px] tracking-[0.3em] text-white/50">SELECT A CATEGORY</div>
          <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-4">{CATEGORIES.map((c) => { const active = c === category; const col = CATEGORY_ACCENT[c]; return <button key={c} type="button" onClick={() => setCategory(c)} className="border px-2 py-3 text-[11px] font-bold tracking-[0.1em] transition-colors" style={{ borderColor: active ? col : 'rgba(255,255,255,0.2)', color: active ? col : 'rgba(255,255,255,0.6)', backgroundColor: active ? `${col}1A` : 'transparent' }}>{c}</button>; })}</div>
          <div className="mb-2 flex items-center justify-between text-[11px] tracking-[0.3em] text-white/50"><span>YOUR PRIVATE WISH</span><span className="tabular-nums text-white/40">{wish.length}/{MAX_WISH}</span></div>
          <textarea value={wish} maxLength={MAX_WISH} onChange={(e) => setWish(e.target.value)} placeholder="TYPE YOUR WISH — IT STAYS ON YOUR TICKET ONLY" className="mb-2 h-32 w-full resize-none border border-white/20 bg-white/5 p-4 text-sm text-white placeholder:text-white/30 focus:border-white/50 focus:outline-none" />
          {wish.length >= MAX_WISH && <div className="mb-2 text-[10px] tracking-[0.2em]" style={{ color: PALETTE.orange }}>MAXIMUM LENGTH REACHED · PLEASE SHORTEN YOUR WISH</div>}
          <div className="mb-6 text-[10px] leading-relaxed tracking-[0.15em] text-white/40">THE SYSTEM DOES NOT READ OR JUDGE THE WISH. IT ONLY ASSIGNS IT A POSITION. ONLY TICKET ID, RESULT AND TIME ENTER THE PUBLIC DISPLAY.</div>
          <button type="button" onClick={start} disabled={!wish.trim()} className="w-full border-2 py-4 text-sm font-bold tracking-[0.3em] transition-colors disabled:opacity-30" style={{ borderColor: accent, color: accent, backgroundColor: `${accent}12` }}>SUBMIT WISH →</button>
        </div>}

        {phase === 'processing' && draw && <div className="py-6"><ProcessingSequence draw={draw} onComplete={handleComplete} /></div>}

        {phase === 'ready' && draw && <div className="py-2">
          {runMode !== 'live' && <div className="mb-4 flex justify-center"><span className="inline-flex items-center gap-2 border-2 px-4 py-1.5 text-[11px] font-black tracking-[0.3em]" style={{ borderColor: PALETTE.yellow, color: PALETTE.yellow, backgroundColor: `${PALETTE.yellow}14` }}><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE.yellow }} />{runMode === 'preview' ? 'TEST PREVIEW — NOT ARCHIVED' : 'TEST RECORD'}</span></div>}
          <div className="mb-1 text-center text-[11px] tracking-[0.5em] text-white/45">YOUR TICKET</div>
          <h2 className="mb-4 text-center text-2xl font-black tracking-[0.28em] text-white">WISH LOTTERY TICKET</h2>
          <div className="mb-5 flex flex-col items-center gap-1"><div className="text-3xl font-black" style={{ color: accentFor(draw.outcome) }}>{draw.outcome}</div><div className="flex items-center gap-3 text-[11px] tracking-[0.25em] text-white/60"><span className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: categoryAccentFor(draw.category) }} />CATEGORY · {draw.category}</span><span className="text-white/30">|</span><span>CIRCULAR DISTANCE {draw.distance} · RANGE {outcomeRangeLabel(draw.distance)}</span></div><div className="mx-auto mt-2 max-w-md text-center text-[11px] leading-relaxed tracking-[0.1em] text-white/60">{OUTCOME_EXPLANATION_LINES[draw.outcome].map((l) => <div key={l}>{l}</div>)}</div></div>
          <div className="mb-3 flex flex-wrap items-center justify-center gap-3"><button type="button" onClick={saveTicket} className="border-2 px-6 py-2.5 text-[12px] font-bold tracking-[0.25em] transition-colors hover:bg-white/10" style={{ borderColor: PALETTE.cyan, color: PALETTE.cyan }}>SAVE TICKET</button><button type="button" onClick={printTicket} disabled={runMode === 'preview'} className="border-2 px-6 py-2.5 text-[12px] font-bold tracking-[0.25em] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30" style={{ borderColor: PALETTE.yellow, color: PALETTE.yellow }}>PRINT TICKET</button><button type="button" onClick={reset} className="border-2 px-6 py-2.5 text-[12px] font-bold tracking-[0.25em] transition-colors hover:bg-white/10" style={{ borderColor: PALETTE.white, color: PALETTE.white }}>NEW WISH ⟲</button></div>
          <div className="mb-6 flex items-center justify-center"><span className="inline-flex items-center gap-2 border px-3 py-1 text-[10px] tracking-[0.3em]" style={{ borderColor: `${statusColor}66`, color: statusColor }}><span className="text-white/40">PRINT STATUS</span><span className="font-bold">{runMode === 'preview' ? 'NOT PRINTED · PREVIEW' : printStatus}</span><span className="text-white/40">· {draw.ticketId}</span></span></div>
          <TicketPreview draw={draw} wishText={wishRef.current} onGraphics={(url) => { ticketPngRef.current = url; }} />
          <div className="mt-3 text-center text-[9px] tracking-[0.3em] text-white/35">PREVIEW ON DARK BACKDROP · PRINTED TICKET GRAPHIC IS TRANSPARENT FOR COLOURED PAPER</div>
        </div>}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4 text-[10px] tracking-[0.25em] text-white/40"><span>NO REAL PRIZES · SIMULATED OUTCOMES</span><div className="flex flex-wrap items-center gap-3"><Link to="/admin" className="border border-white/15 px-3 py-1 text-white/45 hover:border-white/45 hover:text-white/80">◈ ADMIN / TEST CONSOLE</Link><Link to="/projection" className="border border-white/25 px-3 py-1 text-white/80 hover:border-white/60 hover:text-white">PUBLIC PROJECTION →</Link></div></footer>
      </div>
    </div>
  );
}
