const PUBLISHED_APP_ORIGIN = "https://alavanch.lovable.app";

export function getPublicAppOrigin() {
  if (typeof window === "undefined") return PUBLISHED_APP_ORIGIN;

  const { hostname, origin } = window.location;
  const isPreviewHost = hostname.includes("id-preview--") || hostname.includes("lovableproject.com");
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

  return isPreviewHost || isLocalHost ? PUBLISHED_APP_ORIGIN : origin;
}

/**
 * URL pública para assinatura.
 * IMPORTANTE: passe o token do PARTICIPANTE (assinatura_participantes.token),
 * não o token da solicitação. O token da solicitação fica apenas como fallback
 * legado para contratos antigos.
 */
export function getPublicSignatureUrl(token: string) {
  return `${getPublicAppOrigin()}/assinatura/${token}`;
}

export function getParticipanteSignatureUrl(token: string) {
  return getPublicSignatureUrl(token);
}

export function getLegacyPublicContractUrl(token: string) {
  return `${getPublicAppOrigin()}/contrato/${token}`;
}
