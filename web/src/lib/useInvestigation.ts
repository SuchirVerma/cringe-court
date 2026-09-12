import { useCallback, useEffect, useRef, useState } from 'react';
import type { Finding, LogLine, StreamEvent, Verdict } from './types';

type Status = 'idle' | 'running' | 'done' | 'error';

/**
 * Holds one investigation. The SSE stream is the source of truth; this hook
 * only accumulates it and guarantees the connection is closed on unmount or
 * on a second run, so a dangling stream can never keep the server busy.
 */
export function useInvestigation() {
  const [status, setStatus] = useState<Status>('idle');
  const [log, setLog] = useState<LogLine[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ host: string; tier: 1 | 2; siteName: string | null } | null>(null);
  const [activeCharge, setActiveCharge] = useState<string | null>(null);

  const sourceRef = useRef<EventSource | null>(null);
  const lineId = useRef(0);

  const stop = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    (url: string) => {
      stop();
      setStatus('running');
      setLog([]);
      setFindings([]);
      setVerdict(null);
      setError(null);
      setTarget(null);
      setActiveCharge(null);
      lineId.current = 0;

      const source = new EventSource(`/api/investigate?url=${encodeURIComponent(url)}`);
      sourceRef.current = source;

      source.onmessage = (message) => {
        let event: StreamEvent;
        try {
          event = JSON.parse(message.data);
        } catch {
          return;
        }

        switch (event.type) {
          case 'log':
            setLog((prev) => [...prev, { id: lineId.current++, level: event.level, message: event.message }]);
            break;
          case 'opened':
            setTarget({ host: event.host, tier: event.tier, siteName: event.siteName });
            break;
          case 'charge-start':
            setActiveCharge(event.chargeId);
            break;
          case 'finding':
            setFindings((prev) => [...prev, event.finding]);
            setActiveCharge(null);
            break;
          case 'verdict':
            setVerdict(event.verdict);
            break;
          case 'error':
            setError(event.message);
            setStatus('error');
            break;
          case 'done':
            setStatus((s) => (s === 'error' ? s : 'done'));
            stop();
            break;
        }
      };

      // A network-level failure fires onerror with no event payload. Only treat
      // it as fatal if the investigation had not already finished.
      source.onerror = () => {
        setStatus((s) => {
          if (s === 'running') {
            setError('Lost the connection to the court. Is the server running on port 8787?');
            return 'error';
          }
          return s;
        });
        stop();
      };
    },
    [stop],
  );

  return { status, log, findings, verdict, error, target, activeCharge, start, stop };
}
