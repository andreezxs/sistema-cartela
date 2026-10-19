import { useEffect, useMemo, useState } from "react";
import { api, exportUrl } from "../api";
import { brl, brDate } from "../format";

const methodLabel = (methods, id) => methods.find((m) => m.id === id)?.label || id;

export default function BlocksPage({ lots, meta, onChange, onError }) {
  const [blocks, setBlocks] = useState([]);
  const [lotId, setLotId] = useState("");
  const [q, setQ] = useState("");
  const [paid, setPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const load = async () => {
    try {
      const data = await api.blocks({ lotId, q, paid, paymentMethod });
      setBlocks(data);
    } catch (err) {
      onError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [lotId, paid, paymentMethod]);

  const togglePaid = async (block) => {
    try {
      await api.patchBlock(block.id, { paid: !block.paid });
      onChange();
      load();
    } catch (err) {
      onError(err.message);
    }
  };

  const totals = useMemo(() => {
    const received = blocks.filter((b) => b.paid).reduce((s, b) => s + Number(b.amount || 0), 0);
    const pending = blocks.filter((b) => !b.paid).reduce((s, b) => s + Number(b.amount || 0), 0);
    return { received, pending, expected: received + pending, count: blocks.length };
  }, [blocks]);

  return (
    <div className="grid">
      <div className="grid stats">
        <div className="card stat">
          <div className="label">Registros</div>
          <strong>{totals.count}</strong>
        </div>
        <div className="card stat">
          <div className="label">Recebido</div>
          <strong className="money ok">{brl(totals.received)}</strong>
        </div>
        <div className="card stat">
          <div className="label">Pendente</div>
          <strong className="money warn">{brl(totals.pending)}</strong>
        </div>
        <div className="card stat">
          <div className="label">Total filtrado</div>
          <strong>{brl(totals.expected)}</strong>
        </div>
      </div>

      <div className="card">
        <div className="filters">
          <input
            placeholder="Buscar nome, lote ou cartela"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <select value={lotId} onChange={(e) => setLotId(e.target.value)}>
            <option value="">Todos os lotes</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name}
              </option>
            ))}
          </select>
          <select value={paid} onChange={(e) => setPaid(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="true">Pago</option>
            <option value="false">Pendente</option>
          </select>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">Todas as formas</option>
            {meta.paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button className="btn ghost" onClick={load}>Filtrar</button>
          <a className="btn" href={exportUrl(lotId || undefined)}>
            Baixar Excel
          </a>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Bloco</th>
                <th>Lote</th>
                <th>Cartelas</th>
                <th>Brinde</th>
                <th>Forma</th>
                <th>Dia</th>
                <th className="num">Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block) => {
                const sold = (block.cards || []).filter((c) => !c.isGift);
                const gift = (block.cards || []).filter((c) => c.isGift);
                return (
                  <tr key={block.id}>
                    <td><strong>{block.personName}</strong></td>
                    <td>{block.blockNumber}</td>
                    <td>{block.lotName}</td>
                    <td>
                      <div className="scan-chips">
                        {sold.map((card) => (
                          <span key={card.code} className="chip ok">{card.code}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {gift.map((card) => (
                        <span key={card.code} className="chip gift">{card.code}</span>
                      ))}
                    </td>
                    <td>{methodLabel(meta.paymentMethods, block.paymentMethod)}</td>
                    <td>{brDate(block.paymentDate)}</td>
                    <td className="num">{brl(block.amount)}</td>
                    <td>
                      <button className="btn ghost" onClick={() => togglePaid(block)}>
                        <span className={`badge ${block.paid ? "paid" : "pending"}`}>
                          {block.paid ? "Pago" : "Pendente"}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {blocks.length === 0 ? (
                <tr>
                  <td colSpan="9">Nenhum registro encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
