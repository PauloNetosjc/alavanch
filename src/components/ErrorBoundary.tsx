import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { error: Error | null; resetKey: number };

/**
 * Detecta erros causados por extensões/tradutores que mutam o DOM
 * (Google Translate insere <font> em volta dos textos e quebra a
 * reconciliação do React com removeChild/insertBefore on Node).
 */
function isDomMutationByExtension(error: Error | null): boolean {
  if (!error?.message) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes("removechild") ||
    m.includes("insertbefore") ||
    m.includes("failed to execute 'removechild'") ||
    m.includes("failed to execute 'insertbefore'") ||
    m.includes("não é filho deste nó") ||
    m.includes("the node to be removed is not a child")
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: 0 };
  private autoResetAttempts = 0;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);

    // Auto-recovery silencioso para erros de tradução (até 2 tentativas)
    if (isDomMutationByExtension(error) && this.autoResetAttempts < 2) {
      this.autoResetAttempts += 1;
      // pequeno delay para o DOM "assentar"
      setTimeout(() => {
        this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
      }, 50);
    }
  }

  reset = () => {
    this.autoResetAttempts = 0;
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const msg = this.state.error?.message || "Erro inesperado";
      const isTranslateBug = isDomMutationByExtension(this.state.error);
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="surface-card max-w-lg w-full p-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
            <h2 className="text-lg font-semibold">Ops, algo deu errado nesta tela</h2>
            <p className="text-sm text-muted-foreground break-words">{msg}</p>
            {isTranslateBug && (
              <p className="text-xs text-muted-foreground">
                Detectamos um tradutor automático do navegador ativo neste site.
                Clique no ícone do tradutor no Chrome e selecione <strong>“Nunca traduzir este site”</strong>
                para evitar este erro.
              </p>
            )}
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
    // resetKey força remount da árvore após auto-recovery
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}
