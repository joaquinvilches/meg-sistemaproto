import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="text-red-600">⚠️ Algo salió mal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                La aplicación encontró un error inesperado. Por favor, intenta recargar la página.
              </p>

              {this.state.error && (
                <details className="bg-gray-100 p-4 rounded border">
                  <summary className="cursor-pointer font-semibold text-sm mb-2">
                    Detalles técnicos (para soporte)
                  </summary>
                  <pre className="text-xs overflow-auto bg-white p-2 rounded border mt-2">
                    {this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset}>
                  🔄 Recargar Aplicación
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                >
                  ← Volver
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
