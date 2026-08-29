import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Global ErrorBoundary caught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f4f7f9] flex items-center justify-center p-6">
          <div className="bg-white rounded-[16px] border border-[#e2e8ee] p-8 max-w-lg w-full text-center shadow-lg">
            <div className="w-14 h-14 bg-[#fee2e2] text-[#dc2626] rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>
            <h1 className="text-xl font-bold text-[#18232e] mb-2">Something went wrong</h1>
            <p className="text-sm text-[#4a5a6a] mb-6">
              An unexpected error occurred while rendering the dashboard. Our technical team has been notified.
            </p>
            {this.state.error && (
              <div className="bg-[#f8fafc] border border-[#e2e8ee] rounded-[8px] p-3 text-left mb-6 overflow-x-auto text-xs font-mono text-[#dc2626]">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} className="flex items-center gap-2">
                <RefreshCw size={16} />
                Reload Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
