import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl mb-2">404</h1>
        <p className="text-[13px] text-muted-foreground mb-4">Página não encontrada</p>
        <Link to="/" className="text-[12px] underline">
          Voltar
        </Link>
      </div>
    </div>
  );
}
