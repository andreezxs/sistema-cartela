import { brl, brDate } from "../format";
import { exportUrl } from "../api";

export default function Dashboard({ stats, lots, onGo }) {
  if (!stats) return <div className="card">Carregando painel financeiro...</div>;

  const receivedPct = stats.expected ? Math.round((stats.received / stats.expected) * 100) : 0;

  return (
    <div className="grid">
      <div className="grid stats">
        <div className="card stat">
          <div className="label">Recebido</div>
          <strong className="money ok">{brl(stats.received)}</strong>
        </div>
        <div className="card stat">
          <div className="label">Pendente</div>
          <strong className="money warn">{brl(stats.pendingAmount)}</strong>
        </div>
        <div className="card stat">
          <div className="label">Total esperado</div>
          <strong>{brl(stats.expected)}</strong>
        </div>
        <div className="card stat">
          <div className="label">Blocos / pagos</div>
          <strong>{stats.paidBlocks}/{stats.blocks}</strong>
        </div>
      </div>

      <div className="grid two-col">
        <div className="card">
          <div className="section-head">
            <h3 className="display">Resumo do caixa</h3>
            <button className="btn ghost" onClick={() => onGo && onGo("blocks")}>Ver tabela</button>
          </div>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            {stats.paidCards} cartelas vendidas · {stats.giftCards} brindes · {stats.lots} lotes
          </p>
          <div className="progress">
            <span style={{ width: `${receivedPct}%` }} />
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>{receivedPct}% do valor esperado ja recebido</p>
        </div>
        <div className="card">
          <h3 className="display" style={{ marginTop: 0 }}>Por forma de pagamento</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Forma</th>
                  <th>Qtd</th>
                  <th className="num">Recebido</th>
                </tr>
              </thead>
              <tbody>
                {(stats.byMethod || []).map((m) => (
                  <tr key={m.id}>
                    <td>{m.label}</td>
                    <td>{m.count}</td>
                    <td className="num">{brl(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-head">
          <h3 className="display">Lotes</h3>
          <a className="btn" href={exportUrl()}>Exportar Excel</a>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lote</th>
                <th>Blocos</th>
                <th>Pagos</th>
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
                    {lot.notes ? <div style={{ color: "var(--muted)", fontSize: 12 }}>{lot.notes}</div> : null}
                  </td>
                  <td>{lot.blockCount}</td>
                  <td>{lot.paidCount}</td>
                  <td className="num money ok">{brl(lot.received)}</td>
                  <td className="num money warn">{brl(lot.pendingAmount)}</td>
                  <td><a className="btn soft" href={exportUrl(lot.id)}>Excel</a></td>
                </tr>
              ))}
              {lots.length === 0 ? (
                <tr><td colSpan="6">Nenhum lote cadastrado. Crie um lote para comecar.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="display" style={{ marginTop: 0 }}>Ultimos pagamentos</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Lote</th>
                <th>Forma</th>
                <th>Data</th>
                <th className="num">Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recent || []).map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.personName}</strong>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>Bloco {b.blockNumber}</div>
                  </td>
                  <td>{b.lotName}</td>
                  <td>{(stats.byMethod || []).find((m) => m.id === b.paymentMethod)?.label || b.paymentMethod}</td>
                  <td>{brDate(b.paymentDate)}</td>
                  <td className="num">{brl(b.amount)}</td>
                  <td>
                    <span className={`badge ${b.paid ? "paid" : "pending"}`}>
                      {b.paid ? "Pago" : "Pendente"}
                    </span>
                  </td>
                </tr>
              ))}
              {(stats.recent || []).length === 0 ? (
                <tr><td colSpan="6">Nenhum pagamento registrado ainda.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
