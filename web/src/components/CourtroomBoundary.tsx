import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * The interface's version of the always-resolves rule.
 *
 * The detectors already promise never to crash: a charge that cannot be
 * examined resolves to "inconclusive" and says why. This is the same promise on
 * the other side of the wire. One malformed payload, one unexpected shape, and
 * React unmounts the entire tree by default, which on a live demo is a white
 * screen with the investigation lost behind it.
 *
 * So a render fault is contained to the section it happened in, reported in the
 * court's own voice, and everything above it stays on screen.
 */

interface Props {
  children: ReactNode;
  /** What broke, in plain words: "the order", "an exhibit". */
  section: string;
}

interface State {
  failed: boolean;
  detail: string | null;
}

export class CourtroomBoundary extends Component<Props, State> {
  state: State = { failed: false, detail: null };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, detail: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Still logged: contained is not the same as hidden.
    console.error(`CringeCourt could not render ${this.props.section}`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        role="alert"
        className="rounded-[3px] border px-4 py-3 text-[0.86rem] leading-relaxed"
        style={{
          borderColor: 'var(--color-unknown)',
          background: 'rgba(155,140,106,0.08)',
          color: '#e0d3b4',
        }}
      >
        The court could not read {this.props.section} back. The investigation itself finished; this
        is the page failing to set it out.
        {this.state.detail && (
          <span className="mt-1 block font-mono text-[0.72rem]" style={{ color: 'var(--color-unknown)' }}>
            {this.state.detail}
          </span>
        )}
      </div>
    );
  }
}
