import { useEffect, useMemo, useState } from "react";
import { api, exportUrl } from "./api";
import Dashboard from "./pages/Dashboard.jsx";
import ScanPage from "./pages/ScanPage.jsx";
import LotsPage from "./pages/LotsPage.jsx";
import BlocksPage from "./pages/BlocksPage.jsx";

const NAV = [
  { id: "dashboard", label: "Financeiro" },
  { id: "scan", label: "Bipar cartelas" },
  { id: "lots", label: "Lotes" },
  { id: "blocks", label: "Tabela de pagamentos" },
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState("");
  const [meta, setMeta] = useState({ paymentMethods: [], settings: { cardsPerBlock: 10, giftPerBlock: 1, defaultAmount: 50 } });
  const [lots, setLots] = useState([]);
  const [stats, setStats] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  const refresh = async () => {
    const [m, l, d] = await Promise.all([api.meta(), api.lots(), api.dashboard()]);
    setMeta(m);
    setLots(l);
    setStats(d);
  };

  useEffect(() => {
    refresh().catch((err) => showToast(err.message));
  }, []);

  const pageTitle = useMemo(() => NAV.find((n) => n.id === page)?.label || "", [page]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="Jubileu 25 anos Nossa Senhora Aparecida" />
          <div>
            <h1>Jubileu 25 anos</h1>
            <p>Paroquia N. Sra. Aparecida · Maringa-PR</p>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => setPage(item.id)}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="content">
        <div className="topbar">
          <div>
            <h2>{pageTitle}</h2>
            <p>Controle de cartelas, lotes e pagamentos do Jubileu.</p>
          </div>
          <div className="actions">
            <a className="btn ghost" href={exportUrl()}>
              Baixar Excel
            </a>
          </div>
        </div>
        {page === "dashboard" && <Dashboard stats={stats} lots={lots} onGo={setPage} />}
        {page === "scan" && (
          <ScanPage
            lots={lots}
            meta={meta}
            onCreated={() => {
              refresh();
              showToast("Bloco registrado com sucesso.");
            }}
            onError={showToast}
          />
        )}
        {page === "lots" && (
          <LotsPage
            lots={lots}
            meta={meta}
            onChange={refresh}
            onError={showToast}
          />
        )}
        {page === "blocks" && (
          <BlocksPage
            lots={lots}
            meta={meta}
            onChange={refresh}
            onError={showToast}
          />
        )}
      </main>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
