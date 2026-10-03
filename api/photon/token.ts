let cached: { value: string; expiresAt: number } | null = null;

export async function photonToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  const clientId = process.env.PHOTON_CLIENT_ID;
  const clientSecret = process.env.PHOTON_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Photon screening is not configured");
  const response = await fetch(process.env.PHOTON_AUTH_URL ?? "https://auth.neutron.health/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, audience: process.env.PHOTON_AUDIENCE ?? "https://api.neutron.health", grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new Error(`Photon token request failed (${response.status})`);
  const json = await response.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Photon token response did not contain a token");
  cached = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.value;
}
