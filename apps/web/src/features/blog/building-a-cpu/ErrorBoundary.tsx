import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-8 px-4 rounded-xl border border-red-800/30 bg-red-950/20 my-4">
          <p className="text-red-400 text-sm font-medium">This circuit failed to load.</p>
          <p className="text-red-400/60 text-xs font-mono mt-1">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
