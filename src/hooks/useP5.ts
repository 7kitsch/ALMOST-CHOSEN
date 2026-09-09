// Reports readiness for the locally bundled p5 constructor.
// p5 is used in instance-adjacent mode: we read the global `p5` constructor
// and create p5.Graphics buffers / sketches manually.

import { useEffect, useState } from 'react';

declare global {
  // src/main.tsx attaches the bundled p5 constructor to window.
  interface Window {
    p5?: unknown;
  }
}

export function useP5Ready(): boolean {
  const [ready, setReady] = useState<boolean>(
    typeof window !== 'undefined' && typeof window.p5 !== 'undefined',
  );

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    const start = Date.now();
    const timer = window.setInterval(() => {
      if (cancelled) return;
      if (typeof window.p5 !== 'undefined') {
        setReady(true);
        window.clearInterval(timer);
      } else if (Date.now() - start > 12000) {
        window.clearInterval(timer);
      }
    }, 60);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ready]);

  return ready;
}