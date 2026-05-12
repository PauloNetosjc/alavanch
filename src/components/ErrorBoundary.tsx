import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const msg = this.state.error?.message || "Erro inesperado";
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="surface-card max-w-lg w-full p-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
            <h2 className="text-lg font-semibold">Ops, algo deu errado nesta tela</h2>
            <p className="text-sm text-muted-foreground break-words">{msg}</p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" onClick={() => { this.reset(); window.history.back(); }}>
                <Home className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => { this.reset(); window.location.reload(); }}>
                <RefreshCw className="w-4 h-4 mr-1" /> Recarregar
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
