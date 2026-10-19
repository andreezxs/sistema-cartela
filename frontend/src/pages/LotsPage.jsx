import { useState } from "react";
import { api, exportUrl } from "../api";
import { brl } from "../format";

export default function LotsPage({ lots, meta, onChange, onError }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [pricePerBlock, setPricePerBlock] = useState(meta.settings?.defaultAmount || 50);
  const [busy, setBusy] = useState(false);

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createLot({ name, notes, pricePerBlock });
      setName("");
      setNotes("");
      onChange();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid two-col">
      <form className="card" onSubmit={create}>
        <h3 className="display" style={{ marginTop: 0 }}>Novo lote</h3>
        <p className="hint-box">
          Cada bloco tem 10 cartelas + 1 brinde. Informe o valor cobrado por bloco para o financeiro.
        </p>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="field full">
            <label>Nome do lote</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lote 1 — Comunidade Centro" required />
          </div>
          <div className="field">
            <label>Valor do bloco (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pricePerBlock}
              onChange={(e) => setPricePerBlock(e.target.value)}
            />
          </div>
          <div className="field full">
            <label>Observacoes</label>
            <textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy}>
            {busy ? "Salvando..." : "Criar lote"}
          </button>
        </div>
      </form>
      <div className="card">
        <h3 className="display" style={{ marginTop: 0 }}>Lotes cadastrados</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Blocos</th>
                <th className="num">Recebido</th>
                <th className="num">Pendente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td>
                    <strong>{lot.name}</strong>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {brl(lot.pricePerBlock || 0)} por bloco
                      {lot.notes ? ` · ${lot.notes}` : ""}
                    </div>
                  </td>
                  <td>{lot.blockCount} ({lot.paidCount} pagos)</td>
                  <td className="num money ok">{brl(lot.received)}</td>
                  <td className="num money warn">{brl(lot.pendingAmount)}</td>
                  <td>
                    <a className="btn soft" href={exportUrl(lot.id)}>Excel</a>
                  </td>
                </tr>
              ))}
              {lots.length === 0 ? (
                <tr>
                  <td colSpan="5">Nenhum lote ainda.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
