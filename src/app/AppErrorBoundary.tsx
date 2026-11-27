/** Shows "Something went wrong" when rendering fails outside the router. */
import { Component, type ReactNode } from 'react';

import { CrashScreen } from '@/app/RouteError';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
  error: unknown;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { failed: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { failed: true, error };
  }

  override render(): ReactNode {
    return this.state.failed ? <CrashScreen error={this.state.error} /> : this.props.children;
  }
}
