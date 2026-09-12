import { useEffect, useState } from 'react';

interface Health {
  ok: boolean;
  engine: { name: string; available: boolean; version: string | null; reason: string | null };
}

/**
 * Ask the server whether the browser engine is actually usable, once, on load.
 *
 * Without this the first sign of a missing engine is a failed investigation 20
 * seconds in, which reads as the tool being broken rather than not yet set up.
 */
export function useHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);

    fetch('/api/health', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setUnreachable(true);
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const engineMissing = health !== null && !health.engine.available;

  return { health, unreachable, engineMissing };
}
