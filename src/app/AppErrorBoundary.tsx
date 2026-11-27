import { Component, type ReactNode } from 'react';

import { CrashScreen } from '@/app/RouteError';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
  error: unknown;
}

/**
 * The last safety net (master 6.7.1). A render error anywhere outside the router's own
 * error screens (providers, start-up) ends here, with the same
 * "Something went wrong" screen the routes use. Never shows a stack trace.
 *
 * Sits inside ThemeProvider so the screen is themed.
 */
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
