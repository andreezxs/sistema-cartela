export function brl(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function brDate(iso) {
  if (!iso) return "";
  return String(iso).split("-").reverse().join("/");
}
