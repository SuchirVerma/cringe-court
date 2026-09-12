/**
 * The courthouse doors.
 *
 * GET /api/investigate?url=... opens a Server-Sent Events stream and pushes the
 * investigation out as it happens: log lines, findings one at a time, verdict
 * last. SSE rather than websockets because the traffic is one-directional and a
 * dropped connection should just reconnect.
 */

import express from 'express';
import cors from 'cors';
import { investigate } from './investigate.js';
import { CHARGES, GUIDELINES } from './law.js';
import { NAMED_SITES } from './sites.js';
import * as webcmd from './webcmd.js';

const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json());

/** Health, and enough detail for the UI to warn about a missing browser engine. */
app.get('/api/health', async (_req, res) => {
  const engine = await webcmd.available();
  res.json({
    ok: true,
    engine: { name: 'webcmd', available: engine.ok, version: engine.version, reason: engine.reason },
    charges: Object.values(CHARGES).map(({ id, charge, exhibit, annexure }) => ({
      id,
      charge,
      exhibit,
      annexure,
    })),
    namedSites: Object.values(NAMED_SITES).map((s) => ({ key: s.key, display: s.display })),
    citation: GUIDELINES,
  });
});

app.get('/api/investigate', async (req, res) => {
  const url = String(req.query.url || '');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  const emit = (event) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Proxies and browsers both drop a silent stream. A comment frame every 15s
  // keeps it alive without polluting the event log.
  const keepAlive = setInterval(() => {
    if (!closed) res.write(': keep-alive\n\n');
  }, 15_000);

  try {
    await investigate(url, emit);
  } catch (err) {
    // Nothing below should throw, but if it does the client gets a real message
    // rather than a dead socket.
    emit({ type: 'error', message: `The investigation stopped unexpectedly: ${err?.message || err}` });
  } finally {
    clearInterval(keepAlive);
    emit({ type: 'done' });
    if (!closed) res.end();
  }
});

app.listen(PORT, () => {
  console.log(`CringeCourt is in session on http://localhost:${PORT}`);
});
