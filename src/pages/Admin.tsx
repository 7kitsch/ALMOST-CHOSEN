import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OUTCOMES, PALETTE, type Outcome } from '@/lib/engine';
import { archiveStore } from '@/lib/archive';
import {
  getForceResult,
  getIncludeTestRecords,
  setForceResult,
  setIncludeTestRecords,
} from '@/lib/adminConfig';
import { sound } from '@/lib/sound';

export default function Admin() {
  const [force, setForce] = useState<Outcome | null>(getForceResult());
  const [includeTests, setIncludeTests] = useState(getIncludeTestRecords());
  const [count, setCount] = useState(archiveStore.getState().records.length);

  useEffect(() => archiveStore.subscribe((s) => setCount(s.records.length)), []);

  const updateForce = (value: Outcome | null) => {
    setForce(value);
    setForceResult(value);
  };

  const exportArchive = () => {
    const blob = new Blob([JSON.stringify(archiveStore.getState(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `almost-chosen-archive-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-black px-6 py-8 font-mono text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-start justify-between border-b border-white/15 pb-5">
          <div>
            <h1 className="text-lg font-black tracking-[0.3em]">ALMOST CHOSEN</h1>
            <p className="mt-2 text-[11px] tracking-[0.3em]" style={{ color: PALETTE.cyan }}>
              ADMIN / TEST CONSOLE
            </p>
          </div>
          <div className="text-right text-[10px] tracking-[0.2em] text-white/45">
            ARCHIVE RECORDS
            <div className="mt-1 text-2xl font-black text-white">{count}</div>
          </div>
        </header>

        <section className="mb-6 border border-white/15 p-4">
          <div className="mb-3 text-[10px] tracking-[0.25em] text-white/50">FORCE RESULT</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <button
              type="button"
              onClick={() => updateForce(null)}
              className="border px-3 py-3 text-[10px] font-bold"
              style={{ borderColor: force === null ? PALETTE.white : '#333', color: force === null ? PALETTE.white : '#777' }}
            >
              RANDOM
            </button>
            {OUTCOMES.map((outcome) => (
              <button
                key={outcome}
                type="button"
                onClick={() => updateForce(outcome)}
                className="border px-3 py-3 text-[9px] font-bold"
                style={{ borderColor: force === outcome ? PALETTE.pink : '#333', color: force === outcome ? PALETTE.pink : '#777' }}
              >
                {outcome}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/participant?admin_preview=chosen"
            className="border p-4 text-center text-[11px] font-bold tracking-[0.15em]"
            style={{ borderColor: PALETTE.yellow, color: PALETTE.yellow }}
          >
            PREVIEW CHOSEN
          </Link>
          <Link
            to="/participant?admin_test=chosen"
            className="border p-4 text-center text-[11px] font-bold tracking-[0.15em]"
            style={{ borderColor: PALETTE.cyan, color: PALETTE.cyan }}
          >
            TEST FULL CHOSEN FLOW
          </Link>
        </section>

        <section className="mb-6 border border-white/15 p-4">
          <label className="flex items-center justify-between gap-4 text-[11px] tracking-[0.15em]">
            <span>INCLUDE TEST RECORDS IN PUBLIC STATISTICS</span>
            <input
              type="checkbox"
              checked={includeTests}
              onChange={(e) => {
                setIncludeTests(e.target.checked);
                setIncludeTestRecords(e.target.checked);
                archiveStore.resync();
              }}
            />
          </label>
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={exportArchive} className="border border-white/20 p-3 text-[10px] tracking-[0.15em]">
            EXPORT ARCHIVE JSON
          </button>
          <button type="button" onClick={() => archiveStore.clearTestRecords()} className="border border-white/20 p-3 text-[10px] tracking-[0.15em]">
            CLEAR TEST RECORDS
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset the full archive?')) archiveStore.reset();
            }}
            className="border p-3 text-[10px] tracking-[0.15em]"
            style={{ borderColor: PALETTE.orange, color: PALETTE.orange }}
          >
            RESET ARCHIVE
          </button>
        </section>

        <section className="mb-8 border border-white/15 p-4">
          <div className="mb-3 text-[10px] tracking-[0.25em] text-white/50">AUDIO TEST</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OUTCOMES.map((outcome) => (
              <button
                key={outcome}
                type="button"
                onClick={() => sound.outcome(outcome)}
                className="border border-white/20 px-2 py-3 text-[9px] text-white/70"
              >
                {outcome}
              </button>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap gap-3 border-t border-white/15 pt-4 text-[10px] tracking-[0.2em]">
          <Link to="/participant" className="border border-white/20 px-3 py-2">PARTICIPANT</Link>
          <Link to="/projection" className="border border-white/20 px-3 py-2">PUBLIC PROJECTION</Link>
        </footer>
      </div>
    </div>
  );
}
