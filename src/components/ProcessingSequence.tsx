// ALMOST CHOSEN — Four-stage processing animation.
//
// Visualises an ALREADY-FIXED calculation. It NEVER rerolls the numbers.
//   STAGE 1  NUMBERS ASSIGNED       — wish + system land on a 00..99 ring
//   STAGE 2  BOTH PATHS MEASURED    — direct difference vs wrap-around path
//   STAGE 3  SHORTEST PATH SELECTED — longer route fades, shorter highlighted
//   STAGE 4  OUTCOME RANGE          — distance enters its fixed band, reveal
//
// No slot-machine reels, gacha, coins, confetti or rapid flashing — only
// controlled circular motion, scanning and number tracking.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NUMBER_MODULUS,
  OUTCOME_BANDS,
  PALETTE,
  accentFor,
  categoryAccentFor,
  outcomeRangeLabel,
  type DrawResult,
} from '@/lib/engine';

interface Props {
  draw: DrawResult;
  onComplete: () => void;
}

const STAGE_MS = [1600, 2200, 1800, 2200]; // per-stage duration

export default function ProcessingSequence({ draw, onComplete }: Props) {
  const [stage, setStage] = useState(0); // 0..3
  const [progress, setProgress] = useState(0); // 0..1 within current stage
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const completedRef = useRef(false);

  const categoryColor = categoryAccentFor(draw.category);
  const outcomeColor = accentFor(draw.outcome);
  const directShorter = draw.directDifference <= draw.wrapAroundDistance;

  // Stage timing driver.
  useEffect(() => {
    let mounted = true;
    let stageStart = performance.now();
    let currentStage = 0;
    setStage(0);
    const tick = (now: number) => {
      if (!mounted) return;
      const dur = STAGE_MS[currentStage];
      const p = Math.min(1, (now - stageStart) / dur);
      setProgress(p);
      if (p >= 1) {
        if (currentStage < STAGE_MS.length - 1) {
          currentStage += 1;
          setStage(currentStage);
          stageStart = now;
        } else if (!completedRef.current) {
          completedRef.current = true;
          window.setTimeout(() => {
            if (mounted) onComplete();
          }, 500);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canvas drawing of the ring + numbers + paths.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const size = 360;
    cv.width = size * dpr;
    cv.height = size * dpr;
    cv.style.width = `${size}px`;
    cv.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const angleFor = (n: number) => (-90 + (n / NUMBER_MODULUS) * 360) * (Math.PI / 180);
    const cx = size / 2;
    const cy = size / 2;
    const R = size / 2 - 42;

    const render = () => {
      ctx.clearRect(0, 0, size, size);
      // base ring
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      // ticks every 10
      for (let n = 0; n < NUMBER_MODULUS; n += 10) {
        const a = angleFor(n);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
        ctx.lineTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4));
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          n.toString().padStart(2, '0'),
          cx + Math.cos(a) * (R + 18),
          cy + Math.sin(a) * (R + 18),
        );
      }

      const wa = angleFor(draw.wishNumber);
      const sa = angleFor(draw.systemNumber);
      const wp = { x: cx + Math.cos(wa) * R, y: cy + Math.sin(wa) * R };
      const sp = { x: cx + Math.cos(sa) * R, y: cy + Math.sin(sa) * R };

      // arcs between the two numbers (stage >= 1)
      const drawArc = (fromN: number, toN: number, color: string, weight: number, alpha: number) => {
        ctx.strokeStyle = hexA(color, alpha);
        ctx.lineWidth = weight;
        ctx.beginPath();
        const steps = 80;
        const a0 = angleFor(fromN);
        let a1 = angleFor(toN);
        if (a1 < a0) a1 += Math.PI * 2;
        for (let i = 0; i <= steps; i += 1) {
          const a = a0 + (a1 - a0) * (i / steps);
          const x = cx + Math.cos(a) * R;
          const y = cy + Math.sin(a) * R;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      const lo = Math.min(draw.wishNumber, draw.systemNumber);
      const hi = Math.max(draw.wishNumber, draw.systemNumber);

      if (stage >= 1) {
        // stage 2 shows both; stage 3+ fades the longer
        const showBoth = stage === 1;
        const fadeLong = stage >= 2;
        // direct span arc (lo->hi) and wrap arc (hi->lo)
        const directAlpha = fadeLong ? (directShorter ? 0.95 : 0.15) : 0.7;
        const wrapAlpha = fadeLong ? (directShorter ? 0.15 : 0.95) : 0.7;
        drawArc(lo, hi, directShorter ? outcomeColor : PALETTE.dim, 5, showBoth ? 0.7 : directAlpha);
        drawArc(hi, lo, directShorter ? PALETTE.dim : outcomeColor, 5, showBoth ? 0.7 : wrapAlpha);
      }

      // endpoints (stage >= 0)
      const dot = (p: { x: number; y: number }, color: string, label: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, p.x, p.y - 18);
      };
      dot(wp, categoryColor, `W ${draw.wishNumber.toString().padStart(2, '0')}`);
      dot(sp, PALETTE.white, `S ${draw.systemNumber.toString().padStart(2, '0')}`);

      // centre readout
      if (stage >= 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '11px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CIRCULAR DISTANCE', cx, cy - 14);
        ctx.fillStyle = outcomeColor;
        ctx.font = 'bold 40px Arial, sans-serif';
        ctx.fillText(String(draw.distance), cx, cy + 18);
      }

      raf = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(raf);
  }, [stage, draw, categoryColor, outcomeColor, directShorter]);

  const stageTitles = [
    'STAGE 1 — NUMBERS ASSIGNED',
    'STAGE 2 — BOTH PATHS MEASURED',
    'STAGE 3 — SHORTEST PATH SELECTED',
    'STAGE 4 — OUTCOME RANGE',
  ];

  const readouts = useMemo(() => {
    switch (stage) {
      case 0:
        return [
          { label: 'WISH NUMBER', value: draw.wishNumber.toString().padStart(2, '0'), color: categoryColor },
          { label: 'SYSTEM DRAW', value: draw.systemNumber.toString().padStart(2, '0'), color: PALETTE.white },
        ];
      case 1:
        return [
          { label: 'DIRECT DIFFERENCE', value: `|${draw.wishNumber}-${draw.systemNumber}| = ${draw.directDifference}`, color: PALETTE.white },
          { label: 'WRAP-AROUND PATH', value: `100 - ${draw.directDifference} = ${draw.wrapAroundDistance}`, color: PALETTE.white },
        ];
      case 2:
        return [
          { label: 'SHORTER PATH', value: directShorter ? 'DIRECT DIFFERENCE' : 'WRAP-AROUND', color: outcomeColor },
          { label: 'CIRCULAR DISTANCE', value: `min(${draw.directDifference}, ${draw.wrapAroundDistance}) = ${draw.distance}`, color: outcomeColor },
        ];
      default:
        return [
          { label: 'OUTCOME RANGE', value: outcomeRangeLabel(draw.distance), color: outcomeColor },
          { label: 'RESULT', value: draw.outcome, color: outcomeColor },
        ];
    }
  }, [stage, draw, categoryColor, outcomeColor, directShorter]);

  return (
    <div className="flex flex-col items-center">
      {/* stage indicator */}
      <div className="mb-4 flex items-center gap-2">
        {stageTitles.map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-10 rounded-full transition-colors"
            style={{ backgroundColor: i <= stage ? outcomeColor : 'rgba(255,255,255,0.15)' }}
          />
        ))}
      </div>
      <div className="mb-1 text-[11px] font-bold tracking-[0.3em]" style={{ color: outcomeColor }}>
        {stageTitles[stage]}
      </div>
      <div className="mb-4 h-0.5 w-64 overflow-hidden bg-white/10">
        <div className="h-full transition-none" style={{ width: `${progress * 100}%`, backgroundColor: outcomeColor }} />
      </div>

      <canvas ref={canvasRef} className="mb-5" />

      {/* stage 4 range bar */}
      {stage >= 3 && (
        <div className="mb-4 w-full max-w-md">
          <div className="flex h-6 w-full overflow-hidden rounded">
            {OUTCOME_BANDS.map((b) => {
              const active = b.outcome === draw.outcome;
              return (
                <div
                  key={b.outcome}
                  className="flex items-center justify-center text-[8px] font-bold tracking-wide transition-all"
                  style={{
                    width: `${b.percent}%`,
                    backgroundColor: active ? b.accent : `${b.accent}33`,
                    color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
                  }}
                >
                  {b.minDistance === b.maxDistance ? b.minDistance : `${b.minDistance}–${b.maxDistance}`}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {readouts.map((r) => (
          <div key={r.label} className="border border-white/15 p-3">
            <div className="mb-1 text-[9px] tracking-[0.2em] text-white/45">{r.label}</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: r.color }}>
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}