import { Component, type ReactNode } from 'react';

// Minimal error boundary. Used to wrap the lazy WebGL selector so a shader /
// GPU failure degrades gracefully to a fallback (e.g. a static game grid)
// instead of white-screening the home page.
export default class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Surface in dev; harmless in prod.
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
