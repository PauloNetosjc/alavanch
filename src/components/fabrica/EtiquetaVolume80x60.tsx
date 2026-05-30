import React from "react";

interface PecaInfo {
  codigo_peca: string;
  descricao?: string | null;
  medida_largura?: number | null;
  medida_altura?: number | null;
  medida_profundidade?: number | null;
  medida_texto?: string | null;
  modulo?: { codigo_modulo?: string | null; nome_modulo?: string | null } | null;
}

interface Props {
  cliente?: string;
  projeto?: string;
  pedido?: string;
  volume: {
    numero_volume: number;
    codigo_barras: string;
    tipo_volume: string;
    quantidade_pecas: number;
  };
  pecas: PecaInfo[];
}

function fmtMedida(p: PecaInfo) {
  const arr = [p.medida_largura, p.medida_altura, p.medida_profundidade].filter(Boolean);
  if (arr.length) return arr.join(" × ") + " mm";
  return p.medida_texto || "—";
}

/** Etiqueta física 80mm x 60mm. Usar dentro de um container com classe `etiqueta-print` para impressão. */
export const EtiquetaVolume80x60 = React.forwardRef<HTMLDivElement, Props>(
  ({ cliente, projeto, pedido, volume, pecas }, ref) => {
    const conjunta = volume.tipo_volume === "peca_conjunta" || pecas.length > 1;
    return (
      <div
        ref={ref}
        className="etiqueta-print bg-white text-black border border-black/40 font-sans"
        style={{ width: "80mm", height: "60mm", padding: "2mm", boxSizing: "border-box", overflow: "hidden" }}
      >
        <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.5px" }}>
          {cliente || "—"}
        </div>
        <div style={{ fontSize: "7px", color: "#444" }}>
          {projeto || "—"} · Pedido {pedido || "—"}
        </div>
        <div style={{ borderTop: "0.5px solid #999", margin: "1mm 0" }} />
        <div className="flex items-center justify-between" style={{ marginBottom: "0.5mm" }}>
          <div style={{ fontSize: "10px", fontWeight: 800 }}>VOL #{volume.numero_volume}</div>
          <div style={{ fontSize: "7px", textTransform: "uppercase" }}>
            {conjunta ? "Conjunta · 2 pçs" : "Individual · 1 pç"}
          </div>
        </div>

        {pecas.slice(0, 2).map((p, i) => (
          <div key={i} style={{ fontSize: "7.5px", lineHeight: 1.2, marginBottom: "0.5mm" }}>
            <div style={{ fontWeight: 700 }}>
              {conjunta ? `Peça ${i + 1}: ` : ""}{p.codigo_peca}
            </div>
            <div style={{ color: "#222" }}>
              {p.descricao || "—"} · {fmtMedida(p)}
            </div>
            {p.modulo?.codigo_modulo && (
              <div style={{ color: "#555", fontSize: "6.5px" }}>Módulo: {p.modulo.codigo_modulo}</div>
            )}
          </div>
        ))}

        <div style={{ position: "absolute" }} />
        <div className="mt-auto" style={{ marginTop: "1mm" }}>
          <div
            style={{
              fontFamily: "'Libre Barcode 128', 'Courier New', monospace",
              fontSize: "20px",
              letterSpacing: "2px",
              textAlign: "center",
              lineHeight: 1,
            }}
          >
            *{volume.codigo_barras}*
          </div>
          <div style={{ textAlign: "center", fontSize: "7px", fontFamily: "monospace" }}>
            {volume.codigo_barras}
          </div>
        </div>
      </div>
    );
  },
);
EtiquetaVolume80x60.displayName = "EtiquetaVolume80x60";
