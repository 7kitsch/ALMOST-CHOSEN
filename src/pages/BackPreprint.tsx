// ALMOST CHOSEN — Static ticket BACK (/back-preprint).
// A6 reverse side, pre-printed in bulk before the exhibition. Contains NO
// participant-specific data. Export controls (PNG / PDF) are shown only when
// ?admin=1 is present (the Admin view links here with that flag); the bare
// route renders just the design for a clean print.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useP5Ready } from '@/hooks/useP5';
import { A6_WIDTH_MM, A6_HEIGHT_MM } from '@/lib/ticketRecord';
import { renderTicketBack, BACK_W, BACK_H } from '@/lib/ticketBack';
import type { P5Instance } from '@/lib/ticket';

export default function BackPreprint() {
  const p5Ready = useP5Ready();
  const host = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdmin(params.get('admin') === '1');
  }, []);

  useEffect(() => {
    if (!p5Ready || !host.current) return;
    const P5Ctor = (window as unknown as { p5?: new (...a: unknown[]) => unknown }).p5;
    if (!P5Ctor) return;
    const el = host.current;
    el.innerHTML = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sketch = new (P5Ctor as any)((p: P5Instance & Record<string, unknown>) => {
      (p as Record<string, unknown>).setup = () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cnv = (p as any).createCanvas(BACK_W, BACK_H);
          cnv.parent(el);
          const g = renderTicketBack(p);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p as any).image(g, 0, 0);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p as any).noLoop();
          canvasElRef.current = el.querySelector('canvas');
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[back-preprint] render failed:', err);
        }
      };
    }, el);
    return () => {
      try {
        (sketch as { remove?: () => void }).remove?.();
      } catch {
        /* noop */
      }
      el.innerHTML = '';
    };
  }, [p5Ready]);

  const exportPng = useCallback(() => {
    const c = canvasElRef.current;
    if (!c) return;
    const url = c.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ticket-back.png';
    a.click();
  }, []);

  // Minimal, dependency-free PDF: re-encode the canvas to JPEG (valid for the
  // PDF /DCTDecode filter) and embed it as a single A6 page. The back is drawn
  // on transparent, so we flatten onto white first for a clean printed sheet.
  const exportPdf = useCallback(() => {
    const c = canvasElRef.current;
    if (!c) return;
    const flat = document.createElement('canvas');
    flat.width = c.width;
    flat.height = c.height;
    const fctx = flat.getContext('2d');
    if (!fctx) return;
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, flat.width, flat.height);
    fctx.drawImage(c, 0, 0);
    const jpeg = flat.toDataURL('image/jpeg', 0.92);
    // A6 in points: 105mm=297.64pt, 148mm=419.53pt
    const pageW = 297.64;
    const pageH = 419.53;
    const jpegBytes = dataUrlToBytes(jpeg);
    const pdf = buildSingleImagePdf(jpegBytes, flat.width, flat.height, pageW, pageH);
    const blob = new Blob([pdf as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ticket-back.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <>
      <style>{`
        @page { size: A6 portrait; margin: 0; }
        @media print {
          html, body {
            width: ${A6_WIDTH_MM}mm; height: ${A6_HEIGHT_MM}mm;
            margin: 0; padding: 0; overflow: hidden; background: transparent;
          }
          .no-print { display: none !important; }
          #back-sheet canvas {
            width: ${A6_WIDTH_MM}mm !important; height: ${A6_HEIGHT_MM}mm !important;
          }
        }
      `}</style>
      <div className="min-h-screen w-full bg-neutral-200 py-8 font-mono">
        {isAdmin && (
          <div className="no-print mx-auto mb-6 flex max-w-md items-center justify-center gap-3">
            <button
              type="button"
              onClick={exportPng}
              className="border-2 border-neutral-800 bg-white px-4 py-2 text-[11px] font-bold tracking-[0.15em] text-neutral-800 hover:bg-neutral-800 hover:text-white"
            >
              ↓ EXPORT PNG
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="border-2 border-neutral-800 bg-white px-4 py-2 text-[11px] font-bold tracking-[0.15em] text-neutral-800 hover:bg-neutral-800 hover:text-white"
            >
              ↓ EXPORT PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="border-2 border-neutral-800 bg-white px-4 py-2 text-[11px] font-bold tracking-[0.15em] text-neutral-800 hover:bg-neutral-800 hover:text-white"
            >
              ⎙ PRINT BACK
            </button>
          </div>
        )}
        {/* The back is drawn on transparent; show it on a light card for preview. */}
        <div
          id="back-sheet"
          className="mx-auto bg-white shadow-xl"
          style={{ width: `${A6_WIDTH_MM}mm`, height: `${A6_HEIGHT_MM}mm`, overflow: 'hidden' }}
        >
          <div
            ref={host}
            style={{ width: `${A6_WIDTH_MM}mm`, height: `${A6_HEIGHT_MM}mm` }}
            className="[&>canvas]:!h-full [&>canvas]:!w-full"
          />
        </div>
        <div className="no-print mx-auto mt-4 max-w-md text-center text-[10px] tracking-[0.2em] text-neutral-500">
          STATIC PRE-PRINT · NO PARTICIPANT DATA · SEQUENTIAL 00–99
        </div>
      </div>
    </>
  );
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Minimal single-JPEG PDF (no external libs). Embeds a JPEG (DCTDecode) to
// fill one A6 page. Sufficient for a pre-print deliverable / archival export.
function buildSingleImagePdf(
  jpeg: Uint8Array,
  imgW: number,
  imgH: number,
  pageW: number,
  pageH: number,
): Uint8Array {
  const enc = new TextEncoder();
  const header = '%PDF-1.4\n';
  const offsets: number[] = [];
  let cursor = header.length;
  const chunks: Uint8Array[] = [enc.encode(header)];
  const addObj = (body: Uint8Array) => {
    offsets.push(cursor);
    chunks.push(body);
    cursor += body.length;
  };

  addObj(enc.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
  addObj(enc.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));
  addObj(
    enc.encode(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(
        2,
      )} ] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    ),
  );
  const streamHeader = enc.encode(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  const streamFooter = enc.encode('\nendstream\nendobj\n');
  addObj(concat([streamHeader, jpeg, streamFooter]));

  const content = `q ${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm /Im0 Do Q`;
  addObj(
    enc.encode(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`),
  );

  const xrefStart = cursor;
  let xref = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  chunks.push(enc.encode(xref + trailer));
  return concat(chunks);
}

function concat(arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}