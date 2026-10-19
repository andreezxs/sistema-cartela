async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let message = "Falha na requisicao.";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      message = await res.text();
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  meta: () => request("/api/meta"),
  dashboard: () => request("/api/dashboard"),
  lots: () => request("/api/lots"),
  createLot: (payload) =>
    request("/api/lots", { method: "POST", body: JSON.stringify(payload) }),
  blocks: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null))
    ).toString();
    return request(`/api/blocks${qs ? `?${qs}` : ""}`);
  },
  createBlock: (payload) =>
    request("/api/blocks", { method: "POST", body: JSON.stringify(payload) }),
  patchBlock: (id, payload) =>
    request(`/api/blocks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  checkCard: (code) =>
    request("/api/scan/check", { method: "POST", body: JSON.stringify({ code }) }),
};

export function exportUrl(lotId) {
  return lotId ? `/api/export.xlsx?lotId=${encodeURIComponent(lotId)}` : "/api/export.xlsx";
}
