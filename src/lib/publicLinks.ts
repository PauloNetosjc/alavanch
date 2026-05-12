const PUBLISHED_APP_ORIGIN = "https://alavanch.lovable.app";

export function getPublicAppOrigin() {
  if (typeof window === "undefined") return PUBLISHED_APP_ORIGIN;

  const { hostname, origin } = window.location;
  const isPreviewHost = hostname.includes("id-preview--") || hostname.includes("lovableproject.com");
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

  return isPreviewHost || isLocalHost ? PUBLISHED_APP_ORIGIN : origin;
}

export function getPublicSignatureUrl(token: string) {
  return `${getPublicAppOrigin()}/assinatura/${token}`;
}

export function getLegacyPublicContractUrl(token: string) {
  return `${getPublicAppOrigin()}/contrato/${token}`;
}