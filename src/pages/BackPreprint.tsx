// ALMOST CHOSEN — Final static A6 ticket reverse.
// This route displays the same fixed reverse-side artwork used in the final exhibition.

import { A6_WIDTH_MM, A6_HEIGHT_MM } from '@/lib/ticketRecord';

export default function BackPreprint() {
  return (
    <>
      <style>{`
        @page { size: A6 portrait; margin: 0; }
        @media print {
          html, body {
            width: ${A6_WIDTH_MM}mm;
            height: ${A6_HEIGHT_MM}mm;
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: white;
          }
          .no-print { display: none !important; }
          #back-sheet {
            box-shadow: none !important;
          }
          #back-sheet img {
            width: ${A6_WIDTH_MM}mm !important;
            height: ${A6_HEIGHT_MM}mm !important;
          }
        }
      `}</style>

      <div className="min-h-screen w-full bg-neutral-200 py-8 font-mono">
        <div className="no-print mx-auto mb-5 flex max-w-md justify-center">
          <button
            type="button"
            onClick={() => window.print()}
            className="border-2 border-neutral-800 bg-white px-4 py-2 text-[11px] font-bold tracking-[0.15em] text-neutral-800 hover:bg-neutral-800 hover:text-white"
          >
            ⎙ PRINT BACK
          </button>
        </div>

        <div
          id="back-sheet"
          className="mx-auto overflow-hidden bg-white shadow-xl"
          style={{ width: `${A6_WIDTH_MM}mm`, height: `${A6_HEIGHT_MM}mm` }}
        >
          <img
            src="/ticket-back-guide.jpg"
            alt="Almost Chosen final A6 ticket reverse system guide"
            style={{
              display: 'block',
              width: `${A6_WIDTH_MM}mm`,
              height: `${A6_HEIGHT_MM}mm`,
              objectFit: 'fill',
            }}
          />
        </div>

        <div className="no-print mx-auto mt-4 max-w-md text-center text-[10px] tracking-[0.2em] text-neutral-500">
          FINAL STATIC REVERSE · A6 · NO PARTICIPANT DATA
        </div>
      </div>
    </>
  );
}
