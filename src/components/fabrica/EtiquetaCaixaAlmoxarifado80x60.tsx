import React from "react";

interface ItemCaixa {
  referencia: string;
  descricao?: string | null;
  quantidade: number;
  unidade?: string | null;
}

interface Props {
  cliente?: string | null;
  pedido?: string | null;
  caixa: {
    numero_volume: number;
    codigo_barras: string;
    quantidade_pecas?: number;
  };
  itens: ItemCaixa[];
}

export const EtiquetaCaixaAlmoxarifado80x60 = React.forwardRef<HTMLDivElement, Props>(
  ({ cliente, pedido, caixa, itens }, ref) => {
    const max = 6;
    const visiveis = itens.slice(0, max);
    const restantes = Math.max(0, itens.length - max);
    return (
      <div
        ref={ref}
        className="etiqueta-print bg-white text-black border border-black/40 font-sans"
        style={{ width: "80mm", height: "60mm", padding: "2mm", boxSizing: "border-box", overflow: "hidden" }}
      >
        <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.5px" }}>{cliente || "—"}</div>
        <div style={{ fontSize: "7px", color: "#444" }}>Pedido {pedido || "—"}</div>
        <div style={{ borderTop: "0.5px solid #999", margin: "1mm 0" }} />
        <div className="flex items-center justify-between" style={{ marginBottom: "0.5mm" }}>
          <div style={{ fontSize: "11px", fontWeight: 800 }}>CAIXA #{caixa.numero_volume}</div>
          <div style={{ fontSize: "7px", textTransform: "uppercase" }}>Almoxarifado</div>
        </div>

        <div style={{ fontSize: "6.5px", lineHeight: 1.25 }}>
          {visiveis.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "1mm" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.referencia} {it.descricao ? `· ${it.descricao}` : ""}
              </span>
              <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                {it.quantidade}{it.unidade ? ` ${it.unidade}` : ""}
              </span>
            </div>
          ))}
          {restantes > 0 && (
            <div style={{ marginTop: "0.5mm", fontStyle: "italic" }}>+ {restantes} item(ns)…</div>
          )}
        </div>

        <div style={{ marginTop: "1mm" }}>
          <div
            style={{
              fontFamily: "'Libre Barcode 128', 'Courier New', monospace",
              fontSize: "20px",
              letterSpacing: "2px",
              textAlign: "center",
              lineHeight: 1,
            }}
          >
            *{caixa.codigo_barras}*
          </div>
          <div style={{ fontSize: "7px", textAlign: "center", color: "#333" }}>{caixa.codigo_barras}</div>
        </div>
      </div>
    );
  },
);
EtiquetaCaixaAlmoxarifado80x60.displayName = "EtiquetaCaixaAlmoxarifado80x60";
