import { lazy, ComponentType } from "react";

/**
 * Cache-busting lazy loader.
 *
 * Quando o usuário tem o HTML/JS antigo em cache e o deploy novo trocou os
 * hashes dos chunks, o `import()` dinâmico falha com "Failed to fetch
 * dynamically imported module" / "ChunkLoadError". Aqui detectamos esse erro
 * e forçamos um único reload da página (usando sessionStorage para evitar
 * loop infinito). Isso garante que rotas como /sistema/cargos não fiquem
 * apontando para um chunk inexistente após correções.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    const KEY = "lovable:chunk-reload";
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      const isChunkError =
        err?.name === "ChunkLoadError" ||
        /Loading chunk [\d]+ failed/i.test(msg) ||
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /error loading dynamically imported module/i.test(msg);

      if (isChunkError && typeof window !== "undefined") {
        const already = sessionStorage.getItem(KEY);
        if (!already) {
          sessionStorage.setItem(KEY, String(Date.now()));
          // Hard reload, descartando cache do bfcache
          window.location.reload();
          // Retorna um componente vazio enquanto recarrega
          return { default: (() => null) as unknown as T };
        }
      }
      throw err;
    } finally {
      // Limpa flag em carregamento bem sucedido (em outra navegação)
      if (typeof window !== "undefined") {
        setTimeout(() => sessionStorage.removeItem("lovable:chunk-reload"), 5000);
      }
    }
  });
}
