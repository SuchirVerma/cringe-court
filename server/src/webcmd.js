/**
 * webcmd wrapper.
 *
 * Every function here is total: it resolves, it never throws, and it never hangs.
 * A failure comes back as { ok: false, reason } and the caller turns that into an
 * "inconclusive" verdict line. That contract is the whole reliability story, so
 * nothing in this file is allowed to reject.
 *
 * Mechanism: webcmd runs a sandboxed Playwright-style program against a named
 * session and gives it a `page`. We write the program to a temp file with its
 * inputs inlined as a header, run it, and read structured JSON back off stdout.
 */

import { spawn } from 'node:child_process';
import { writeFile, mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROGRAM_DIR = path.join(HERE, '..', 'browser-programs');

const BIN = process.env.WEBCMD_BIN || 'webcmd';
const PROFILE = process.env.WEBCMD_PROFILE || 'cringecourt';

/** Per-step ceiling. One slow page must not hold the whole investigation. */
export const TIMEOUTS = {
  session: 45_000,
  program: 40_000,
  short: 15_000,
};

/**
 * Run a command, capturing output, killing it on timeout.
 * Resolves { ok, code, stdout, stderr, timedOut } — never rejects.
 */
function exec(args, { timeout = TIMEOUTS.short, cwd } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(BIN, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ ok: false, code: null, stdout: '', stderr: String(err), timedOut: false });
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      finish({ ok: false, code: null, stdout, stderr, timedOut: true });
    }, timeout);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      finish({ ok: false, code: null, stdout, stderr: stderr + String(err), timedOut });
    });
    child.on('close', (code) => {
      finish({ ok: code === 0, code, stdout, stderr, timedOut });
    });
  });
}

/**
 * Pull a JSON value out of CLI output that may also carry a banner, log lines,
 * or ANSI colour. Scans for the last balanced {...} or [...] and parses it.
 */
export function extractJson(raw) {
  if (!raw) return null;
  const text = raw.replace(/\[[0-9;]*m/g, '');

  // Fast path: the whole thing is JSON.
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through to scanning */
    }
  }

  for (const opener of ['{', '[']) {
    const closer = opener === '{' ? '}' : ']';
    const start = text.lastIndexOf(`\n${opener}`) >= 0 ? text.lastIndexOf(`\n${opener}`) + 1 : text.indexOf(opener);
    if (start < 0) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (inString) continue;
      if (ch === opener) depth++;
      else if (ch === closer) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

/** Is the webcmd binary present and runnable? */
export async function available() {
  const res = await exec(['--version'], { timeout: 10_000 });
  const version = res.stdout.trim().split('\n').pop();
  return { ok: res.ok, version: res.ok ? version : null, reason: res.ok ? null : res.stderr.trim() };
}

/**
 * Open a browser session. Returns { ok, sessionId, reason }.
 */
export async function createSession(name = 'cringecourt') {
  const safe = `${name}-${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9-]/g, '-');
  const res = await exec(['--profile', PROFILE, 'session', 'create', safe, '-f', 'json'], {
    timeout: TIMEOUTS.session,
  });

  if (!res.ok) {
    return {
      ok: false,
      sessionId: null,
      reason: res.timedOut
        ? 'Browser session did not open within 45 seconds'
        : firstLine(res.stderr) || 'Browser session could not be opened',
    };
  }

  const parsed = extractJson(res.stdout);
  const sessionId =
    parsed?.id ||
    parsed?.sessionId ||
    parsed?.session?.id ||
    // Last resort: the CLI prints "id: <value>".
    (res.stdout.match(/\bid:\s*([A-Za-z0-9._-]+)/) || [])[1] ||
    null;

  if (!sessionId) {
    return { ok: false, sessionId: null, reason: 'Session opened but no session id was returned' };
  }
  return { ok: true, sessionId, reason: null };
}

/** Close a session. Failure here is logged, never fatal. */
export async function closeSession(sessionId) {
  if (!sessionId) return { ok: true };
  const res = await exec(['--profile', PROFILE, 'session', 'close', sessionId], {
    timeout: TIMEOUTS.short,
  });
  return { ok: res.ok, reason: res.ok ? null : firstLine(res.stderr) };
}

/**
 * Run one of our browser programs against a session.
 *
 * The program is a module body that receives `page` and returns a value. Inputs
 * are inlined as a `const INPUT = {...}` header so we do not depend on a CLI
 * argument-passing convention.
 *
 * Returns { ok, data, reason }.
 */
export async function runProgram(sessionId, programName, input = {}) {
  if (!sessionId) return { ok: false, data: null, reason: 'No browser session' };

  const programPath = path.join(PROGRAM_DIR, `${programName}.js`);
  let body;
  try {
    body = await readFile(programPath, 'utf8');
  } catch {
    return { ok: false, data: null, reason: `Missing browser program: ${programName}` };
  }

  const header = `const INPUT = ${JSON.stringify(input)};\n`;
  let dir;
  try {
    dir = await mkdtemp(path.join(tmpdir(), 'cringecourt-'));
    const file = path.join(dir, `${programName}.js`);
    await writeFile(file, header + body, 'utf8');

    const res = await exec(
      ['--profile', PROFILE, '--session', sessionId, 'browser', 'run', '--file', file, '-f', 'json'],
      { timeout: TIMEOUTS.program },
    );

    if (res.timedOut) {
      return { ok: false, data: null, reason: 'Page analysis timed out after 40 seconds' };
    }

    const parsed = extractJson(res.stdout);
    // webcmd may wrap the return value; unwrap the common shapes.
    const data = parsed?.result ?? parsed?.data ?? parsed;

    if (!res.ok && data == null) {
      return {
        ok: false,
        data: null,
        reason: firstLine(res.stderr) || firstLine(res.stdout) || 'Browser program failed',
      };
    }
    if (data == null) {
      return { ok: false, data: null, reason: 'Browser program returned nothing readable' };
    }
    return { ok: true, data, reason: null };
  } catch (err) {
    return { ok: false, data: null, reason: `Could not run page analysis: ${err.message}` };
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function firstLine(s) {
  if (!s) return null;
  const line = s
    .replace(/\[[0-9;]*m/g, '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ? line.slice(0, 200) : null;
}
