
import React, { type ErrorInfo, type ReactNode } from "react";
import { ErrorDisplay } from "./ErrorDisplay";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  title?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * React error boundary for circuit embed components.
 * Catches render errors and displays a styled fallback instead of crashing.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return typeof this.props.fallback === "function"
          ? this.props.fallback(this.state.error)
          : this.props.fallback;
      }
      return (
        <ErrorDisplay
          error={this.state.error.message}
          title={this.props.title ?? "Render Error"}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
