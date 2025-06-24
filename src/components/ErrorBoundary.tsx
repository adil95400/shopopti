import React, { Component, ErrorInfo, ReactNode } from 'react';

import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Optionally log error to an error reporting service like Sentry
    const anyWindow = window as unknown as { Sentry?: { captureException: (e: Error, context?: unknown) => void } };
    if (anyWindow.Sentry && typeof anyWindow.Sentry.captureException === 'function') {
      anyWindow.Sentry.captureException(error, { extra: errorInfo });
    }
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen text-center p-4">
          <h1 className="text-2xl font-semibold mb-2">Something went wrong.</h1>
          <p className="mb-4">An unexpected error occurred. Please try refreshing the page.</p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
