// ALMOST CHOSEN — Hidden admin / test controls.
// Toggle with the keyboard shortcut Shift+A, or the tiny corner hotspot.
// Provides: reset archive, export archive JSON, FORCE_RESULT preview of all
// four visuals, test all sound cues, and the master-volume control.

import { useCallback, useEffect, useState } from 'react';
import { OUTCOMES, PALETTE, type Outcome } from '@/lib/engine';
import { archiveStore } from '@/lib/archive';
import { sound } from '@/lib/sound';
import { getForceResult, setForceResult } from '@/lib/adminConfig';

interface AdminPanelProps {
  // Optional: preview a forced result visually on the host page.
  onPreviewResult?: (outcome: Outcome) => void;
}

export default function AdminPanel({ onPreviewResult }: AdminPanelProps) {
  const [open, setOpen] = useState(false);
  const [force, setForce] = useState<Outcome | null>(getForceResult());
  const [volume, setVolume] = useState(sound.getVolume());
  const [muted, setMuted] = useState(sound.isMuted());
  const [count, setCount] = useState(archiveStore.getState().records.length);
  const [drawResult, setDrawResult] = useState<Outcome>('CHOSEN');
  const [chosenLvl, setChosenLvl] = useState(sound.getChosenLevel());
  const [procLvl, setProcLvl] = useState(sound.getProcessingLevel());
  const [otherLvl, setOtherLvl] = useState(sound.getOtherResultsLevel());
  const [reverbAmt, setReverbAmt] = useState(sound.getReverb());

  useEffect(() => archiveStore.subscribe((s) => setCount(s.records.length)), []);

  // Shift+A toggles the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        const target = e.target as HTMLElement | null;
        // don't hijack typing inside inputs/textareas
        if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const applyForce = useCallback(
    (o: Outcome | null) => {
      setForce(o);
      setForceResult(o);
    },
    [],
  );

  const exportJson = () => {
    const state = archiveStore.getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `almost-chosen-archive-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetArchive = () => {
    if (window.confirm('Reset the entire anonymous archive? This cannot be undone.')) {
      archiveStore.reset();
    }
  };

  return (
    <>
      {/* tiny invisible corner hotspot to open on touch devices */}
      <button
        type="button"
        aria-label="admin"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-0 right-0 z-40 h-6 w-6 opacity-0"
      />

      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-80 border-2 bg-black/95 p-4 font-mono text-white shadow-2xl backdrop-blur"
          style={{ borderColor: PALETTE.cyan }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-[0.3em]" style={{ color: PALETTE.cyan }}>
              ◈ ADMIN / TEST MODE
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/50 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="mb-2 text-[10px] tracking-[0.2em] text-white/45">
            ARCHIVE RECORDS · {count}
          </div>

          {/* Archive controls */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={exportJson}
              className="border px-2 py-2 text-[10px] font-bold tracking-[0.15em] transition-colors hover:bg-white/10"
              style={{ borderColor: PALETTE.blue, color: PALETTE.blue }}
            >
              ↓ EXPORT JSON
            </button>
            <button
              type="button"
              onClick={resetArchive}
              className="border px-2 py-2 text-[10px] font-bold tracking-[0.15em] transition-colors hover:bg-white/10"
              style={{ borderColor: PALETTE.orange, color: PALETTE.orange }}
            >
              ⟲ RESET ARCHIVE
            </button>
          </div>

          {/* FORCE_RESULT */}
          <div className="mb-1 text-[10px] tracking-[0.2em] text-white/45">FORCE_RESULT</div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => applyForce(null)}
              className="border px-2 py-2 text-[10px] font-bold tracking-[0.1em] transition-colors"
              style={{
                borderColor: force === null ? PALETTE.white : 'rgba(255,255,255,0.2)',
                color: force === null ? PALETTE.white : 'rgba(255,255,255,0.6)',
                backgroundColor: force === null ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}
            >
              RANDOM
            </button>
            {OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => applyForce(o)}
                className="border px-2 py-2 text-[9px] font-bold tracking-[0.05em] transition-colors"
                style={{
                  borderColor: force === o ? PALETTE.pink : 'rgba(255,255,255,0.2)',
                  color: force === o ? PALETTE.pink : 'rgba(255,255,255,0.6)',
                  backgroundColor: force === o ? `${PALETTE.pink}22` : 'transparent',
                }}
              >
                {o}
              </button>
            ))}
          </div>

          {/* Preview result visuals */}
          {onPreviewResult && (
            <>
              <div className="mb-1 text-[10px] tracking-[0.2em] text-white/45">
                TEST RESULT VISUALS
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {OUTCOMES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => onPreviewResult(o)}
                    className="border border-white/20 px-2 py-2 text-[9px] font-bold tracking-[0.05em] text-white/70 transition-colors hover:bg-white/10"
                  >
                    ▸ {o}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Sound cue tests */}
          <div className="mb-1 text-[10px] tracking-[0.2em] text-white/45">SOUND TESTS</div>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => sound.submit()}
              className="border border-white/20 px-1 py-1.5 text-[8px] font-bold tracking-[0.05em] text-white/70 hover:bg-white/10"
            >
              TEST INPUT SUBMITTED
            </button>
            <button
              type="button"
              onClick={() => sound.playFullProcessingSequence()}
              className="border border-white/20 px-1 py-1.5 text-[8px] font-bold tracking-[0.05em] text-white/70 hover:bg-white/10"
            >
              TEST FULL PROCESSING
            </button>
            <button
              type="button"
              onClick={() => sound.playChosenSound()}
              className="border px-1 py-1.5 text-[8px] font-bold tracking-[0.05em] hover:bg-white/10"
              style={{ borderColor: PALETTE.pink, color: PALETTE.pink }}
            >
              TEST CHOSEN
            </button>
            <button
              type="button"
              onClick={() => sound.playAlmostChosenSound()}
              className="border px-1 py-1.5 text-[8px] font-bold tracking-[0.05em] hover:bg-white/10"
              style={{ borderColor: PALETTE.yellow, color: PALETTE.yellow }}
            >
              TEST ALMOST CHOSEN
            </button>
            <button
              type="button"
              onClick={() => sound.playRegisteredSound()}
              className="border px-1 py-1.5 text-[8px] font-bold tracking-[0.05em] hover:bg-white/10"
              style={{ borderColor: PALETTE.blue, color: PALETTE.blue }}
            >
              TEST REGISTERED
            </button>
            <button
              type="button"
              onClick={() => sound.playNotThisTimeSound()}
              className="border px-1 py-1.5 text-[8px] font-bold tracking-[0.05em] hover:bg-white/10"
              style={{ borderColor: PALETTE.orange, color: PALETTE.orange }}
            >
              TEST NOT THIS TIME
            </button>
          </div>

          {/* Full draw audio (choose result, then play the whole sequence) */}
          <div className="mb-1 text-[10px] tracking-[0.2em] text-white/45">TEST FULL DRAW AUDIO</div>
          <div className="mb-2 grid grid-cols-4 gap-1">
            {OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setDrawResult(o)}
                className="border px-1 py-1 text-[7px] font-bold leading-tight tracking-[0.02em] transition-colors"
                style={{
                  borderColor: drawResult === o ? PALETTE.cyan : 'rgba(255,255,255,0.2)',
                  color: drawResult === o ? PALETTE.cyan : 'rgba(255,255,255,0.6)',
                  backgroundColor: drawResult === o ? `${PALETTE.cyan}22` : 'transparent',
                }}
              >
                {o}
              </button>
            ))}
          </div>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => sound.playFullDrawAudio(drawResult)}
              className="border px-1 py-1.5 text-[8px] font-bold tracking-[0.05em] hover:bg-white/10"
              style={{ borderColor: PALETTE.cyan, color: PALETTE.cyan }}
            >
              ▶ PLAY FULL DRAW AUDIO
            </button>
            <button
              type="button"
              onClick={() => sound.stopAll()}
              className="border px-1 py-1.5 text-[8px] font-bold tracking-[0.05em] hover:bg-white/10"
              style={{ borderColor: PALETTE.orange, color: PALETTE.orange }}
            >
              ■ STOP ALL AUDIO
            </button>
          </div>

          {/* Master volume */}
          <div className="mt-4 border-t border-white/15 pt-3">
            <div className="mb-2 flex items-center justify-between text-[10px] tracking-[0.2em] text-white/45">
              <span>MASTER VOLUME</span>
              <span className="tabular-nums" style={{ color: PALETTE.yellow }}>
                {muted ? 'MUTED' : `${Math.round(volume * 100)}%`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const m = sound.toggleMuted();
                  setMuted(m);
                }}
                className="border border-white/20 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                {muted ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  setVolume(v);
                  sound.setVolume(v);
                  if (muted && v > 0) {
                    sound.setMuted(false);
                    setMuted(false);
                  }
                }}
                className="h-1 flex-1 cursor-pointer accent-cyan-400"
                style={{ accentColor: PALETTE.cyan }}
              />
            </div>

            {/* Per-cue mix controls */}
            <LevelSlider
              label="CHOSEN LEVEL"
              color={PALETTE.pink}
              value={chosenLvl}
              onChange={(v) => {
                setChosenLvl(v);
                sound.setChosenLevel(v);
              }}
            />
            <LevelSlider
              label="PROCESSING LEVEL"
              color={PALETTE.blue}
              value={procLvl}
              onChange={(v) => {
                setProcLvl(v);
                sound.setProcessingLevel(v);
              }}
            />
            <LevelSlider
              label="OTHER RESULTS LEVEL"
              color={PALETTE.violet}
              value={otherLvl}
              onChange={(v) => {
                setOtherLvl(v);
                sound.setOtherResultsLevel(v);
              }}
            />
            <LevelSlider
              label="REVERB AMOUNT"
              color={PALETTE.cyan}
              value={reverbAmt}
              onChange={(v) => {
                setReverbAmt(v);
                sound.setReverb(v);
              }}
            />
          </div>

          <div className="mt-3 text-center text-[9px] tracking-[0.2em] text-white/30">
            SHIFT + A TO TOGGLE
          </div>
        </div>
      )}
    </>
  );
}

interface LevelSliderProps {
  label: string;
  color: string;
  value: number;
  onChange: (v: number) => void;
}

function LevelSlider({ label, color, value, onChange }: LevelSliderProps) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.2em] text-white/45">
        <span>{label}</span>
        <span className="tabular-nums" style={{ color }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-1 w-full cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
  );
}
