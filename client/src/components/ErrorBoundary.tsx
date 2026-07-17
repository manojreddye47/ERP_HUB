import React from 'react';

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn("ErrorBoundary caught a React runtime error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {this.props.fallback}
          <div style={{ 
            padding: '10px 14px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px dashed rgba(239, 68, 68, 0.3)', 
            borderRadius: '6px', 
            fontSize: '11px', 
            color: 'var(--danger)', 
            fontFamily: 'monospace', 
            textAlign: 'left', 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            <strong>Error Trace:</strong> {this.state.error?.message || 'Unknown Exception'}
            {this.state.error?.stack && (
              <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '4px' }}>
                {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
