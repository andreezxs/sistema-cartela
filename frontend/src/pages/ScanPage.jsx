import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { brl } from "../format";

const today = () => new Date().toISOString().slice(0, 10);

function emptyDraft(settings) {
  const total = settings.cardsPerBlock + settings.giftPerBlock;
  return Array.from({ length: total }, (_, i) => ({
    code: "",
    isGift: i >= settings.cardsPerBlock,
  }));
}

export default function ScanPage({ lots, meta, onCreated, onError }) {
  const settings = meta.settings || { cardsPerBlock: 10, giftPerBlock: 1, defaultAmount: 50 };
  const totalNeeded = settings.cardsPerBlock + settings.giftPerBlock;
  const inputRef = useRef(null);

  const [lotId, setLotId] = useState(lots[0]?.id || "");
  const [personName, setPersonName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(meta.paymentMethods[0]?.id || "pix");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paid, setPaid] = useState(true);
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState(settings.defaultAmount || 50);
  const [cards, setCards] = useState(() => emptyDraft(settings));
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  const filled = cards.filter((c) => c.code).length;
  const nextIndex = cards.findIndex((c) => !c.code);
  const ready = filled === totalNeeded && lotId && personName && paymentMethod && paymentDate;

  useEffect(() => {
    if (!lotId && lots[0]?.id) setLotId(lots[0].id);
  }, [lots, lotId]);

  useEffect(() => {
    if (!paymentMethod && meta.paymentMethods[0]?.id) {
      setPaymentMethod(meta.paymentMethods[0].id);
    }
  }, [meta.paymentMethods, paymentMethod]);

  const selectedLot = useMemo(() => lots.find((l) => l.id === lotId), [lots, lotId]);

  useEffect(() => {
    if (selectedLot && selectedLot.pricePerBlock != null) {
      setAmount(selectedLot.pricePerBlock);
    }
  }, [selectedLot]);

  const addCode = async (raw) => {
    const code = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!code) return;
    if (cards.some((c) => c.code === code)) {
      setHint(`Cartela ${code} ja esta neste bloco.`);
      return;
    }
    const idx = cards.findIndex((c) => !c.code);
    if (idx < 0) {
      setHint("Bloco completo. Salve ou limpe para bipar outro.");
      return;
    }
    try {
      const check = await api.checkCard(code);
      if (!check.available) {
        setHint(`Cartela ${code} ja pertence a ${check.owner.personName}.`);
        return;
      }
      const next = cards.slice();
      next[idx] = { ...next[idx], code };
      setCards(next);
      setHint(
        idx === settings.cardsPerBlock
          ? `${code} registrada como brinde.`
          : `${code} ok · ${idx + 1}/${settings.cardsPerBlock}`
      );
    } catch (err) {
      onError(err.message);
    }
  };

  const onScan = async (event) => {
    event.preventDefault();
    const value = event.target.code.value;
    event.target.reset();
    await addCode(value);
    inputRef.current?.focus();
  };

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await api.createBlock({
        lotId,
        personName,
        paymentMethod,
        paymentDate,
        paid,
        notes,
        amount,
        cards,
      });
      setPersonName("");
      setNotes("");
      setCards(emptyDraft(settings));
      setHint("Bloco salvo. Pode bipar o proximo.");
      onCreated();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const resetCards = () => {
    setCards(emptyDraft(settings));
    setHint("Bipagem limpa.");
    inputRef.current?.focus();
  };

  return (
    <div className="grid two-col">
      <section className="card scan-hero">
        <h3 className="display" style={{ marginTop: 0, fontSize: 28 }}>Bipar cartelas</h3>
        <p style={{ color: "var(--muted)" }}>
          1. Selecione o lote e o nome. 2. Bipe as {settings.cardsPerBlock} cartelas.
          3. A ultima e o brinde. 4. Confirme o pagamento e registre.
        </p>
        <form onSubmit={onScan}>
          <input
            ref={inputRef}
            name="code"
            className="scan-input"
            autoFocus
            autoComplete="off"
            placeholder="BIPE AQUI"
          />
        </form>
        <div className="progress">
          <span style={{ width: `${(filled / totalNeeded) * 100}%` }} />
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          {filled}/{totalNeeded}
          {nextIndex === settings.cardsPerBlock ? " · proxima e a cartela de brinde" : ""}
        </p>
        <div className="scan-chips">
          {cards.map((card, i) => (
            <span
              key={i}
              className={`chip ${card.isGift ? "gift" : ""} ${card.code ? "ok" : ""}`}
            >
              {card.isGift ? "Brinde" : i + 1}. {card.code || "—"}
            </span>
          ))}
        </div>
        {hint ? <p className="ok-msg">{hint}</p> : null}
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn" disabled={!ready || busy} onClick={save}>
            {busy ? "Salvando..." : "Registrar bloco"}
          </button>
          <button className="btn ghost" type="button" onClick={resetCards}>
            Limpar bipagem
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="display" style={{ marginTop: 0 }}>Dados do pagamento</h3>
        <div className="form-grid">
          <div className="field full">
            <label>Lote</label>
            <select value={lotId} onChange={(e) => setLotId(e.target.value)}>
              <option value="">Selecione</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label>Nome da pessoa</label>
            <input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Ex.: Maria Souza" />
          </div>
          <div className="field">
            <label>Forma de pagamento</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {meta.paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Dia do pagamento</label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Valor do bloco (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={paid ? "pago" : "pendente"} onChange={(e) => setPaid(e.target.value === "pago")}>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
          <div className="field full">
            <label>Observacoes</label>
            <textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        {selectedLot ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Lote {selectedLot.name} · valor padrao {brl(selectedLot.pricePerBlock || amount)}
          </p>
        ) : (
          <p className="error">Crie um lote na aba Lotes antes de bipar.</p>
        )}
      </section>
    </div>
  );
}
