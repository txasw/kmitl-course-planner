// The one class component in the codebase. React has no hook for an error boundary,
// so catching a render error needs componentDidCatch, which only a class provides.
// It wraps the panel body so a render error there shows a recovery card rather than
// white screening the host page, and because the launcher is a sibling of the panel,
// not a child of this boundary, the launcher stays alive and the host is one action
// away. The fallback receives a reset so a recovery action can re-render the children.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/lib/utils/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered in place of the children after a caught error. The reset clears the
   * error and re-renders the children, so a recovery action can retry. */
  fallback: (reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The logger no-ops in production, so this leaves no user data anywhere; it is a
    // developer signal in the debug build only.
    logger.error(
      'panel error boundary caught a render error',
      error,
      info.componentStack,
    );
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error !== null) {
      return this.props.fallback(this.reset);
    }
    return this.props.children;
  }
}
