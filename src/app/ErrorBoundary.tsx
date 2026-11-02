import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: (reset: () => void) => ReactNode;
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PULLUP PRO crashed:', error, info.componentStack);
  }

  override render() {
    if (this.state.error) return this.props.fallback(() => this.setState({ error: null }));
    return this.props.children;
  }
}
