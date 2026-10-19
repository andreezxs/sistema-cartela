import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { brl } from "../format";
import { useBarcodeScanner } from "../useBarcodeScanner";

const today = () => new Date().toISOString().slice(0, 10);

function emptyDraft(settings) {
  const total = settings.cardsPerBlock + settings.giftPerBlock;
  return Array.from({ length: total }, (_, i) => ({
    code: "",
    isGift: i >= settings.cardsPerBlock,
  }));
}

function beep(ok) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.05;
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.18));
  } catch {
    /* ignore */
  }
}

export default function ScanPage({ lots, meta, onCreated, onError }) {
  const settings = meta.settings || { cardsPerBlock: 10, giftPerBlock: 1, defaultAmount: 50 };
  const totalNeeded = settings.cardsPerBlock + settings.giftPerBlock;
  const inputRef = useRef(null);
  const cardsRef = useRef(emptyDraft(settings));
  const busyRef = useRef(false);

  const [mode, setMode] = useState("register");
  const [lotId, setLotId] = useState(lots[0]?.id || "");
  const [personName, setPersonName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(meta.paymentMethods[0]?.id || "pix");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paid, setPaid] = useState(true);
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState(settings.defaultAmount || 50);
  const [cards, setCards] = useState(() => emptyDraft(settings));
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("Leitor pronto. Bipe a primeira cartela.");
  const [hintOk, setHintOk] = useState(true);
  const [listening, setListening] = useState(true);
  const [query, setQuery] = useState(null);

  cardsRef.current = cards;
  busyRef.current = busy;

  const filled = cards.filter((c) => c.code).length;
  const nextIndex = cards.findIndex((c) => !c.code);
  const ready = filled === totalNeeded && lotId && personName && paymentMethod && paymentDate;

  const focusScanner = () => {
    window.setTimeout(() => inputRef.current?.focus(), 10);
  };

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

  useEffect(() => {
    focusScanner();
  }, [mode]);

  const setCardsSafe = (next) => {
    cardsRef.current = next;
    setCards(next);
  };

  const addCode = useCallback(async (raw) => {
    const code = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/[\u0000-\u001F]/g, "")
      .replace(/\s+/g, "");
    if (!code || busyRef.current) return;

    if (mode === "lookup") {
      try {
        const check = await api.checkCard(code);
        if (check.available) {
          setQuery({ code, found: false });
          setHint(`Cartela ${code} ainda nao foi registrada.`);
          setHintOk(true);
          beep(true);
        } else {
          setQuery({ code, found: true, ...check.owner });
          setHint(`Cartela ${code} encontrada.`);
          setHintOk(true);
          beep(true);
        }
      } catch (err) {
        setHintOk(false);
        onError(err.message);
        beep(false);
      }
      focusScanner();
      return;
    }

    const current = cardsRef.current;
    if (current.some((c) => c.code === code)) {
      setHint(`Cartela ${code} ja esta neste bloco.`);
      setHintOk(false);
      beep(false);
      focusScanner();
      return;
    }
    const idx = current.findIndex((c) => !c.code);
    if (idx < 0) {
      setHint("Bloco completo. Confira o pagamento e registre.");
      setHintOk(false);
      beep(false);
      focusScanner();
      return;
    }
    try {
      const check = await api.checkCard(code);
      if (!check.available) {
        setHint(`Cartela ${code} ja pertence a ${check.owner.personName}.`);
        setHintOk(false);
        beep(false);
        focusScanner();
        return;
      }
      const next = current.slice();
      next[idx] = { ...next[idx], code };
      setCardsSafe(next);
      const done = next.filter((c) => c.code).length;
      setHintOk(true);
      setHint(
        idx === settings.cardsPerBlock
          ? `${code} registrada como brinde. Bloco completo.`
          : `${code} lida · ${idx + 1}/${settings.cardsPerBlock}`
      );
      beep(true);
      if (done === totalNeeded) {
        setHint("11 cartelas lidas. Confira os dados e registre o bloco.");
      }
    } catch (err) {
      setHintOk(false);
      onError(err.message);
      beep(false);
    }
    focusScanner();
  }, [mode, onError, settings.cardsPerBlock, totalNeeded]);

  useBarcodeScanner({
    onScan: addCode,
    enabled: listening,
    pauseWhenTyping: true,
  });

  const onScanSubmit = async (event) => {
    event.preventDefault();
    const value = event.target.code.value;
    event.target.reset();
    await addCode(value);
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
        cards: cardsRef.current,
      });
      setPersonName("");
      setNotes("");
      setCardsSafe(emptyDraft(settings));
      setHint("Bloco salvo. Bipe o proximo bloco.");
      setHintOk(true);
      onCreated();
      beep(true);
    } catch (err) {
      setHintOk(false);
      onError(err.message);
      beep(false);
    } finally {
      setBusy(false);
      focusScanner();
    }
  };

  const resetCards = () => {
    setCardsSafe(emptyDraft(settings));
    setHint("Bipagem limpa. Leitor pronto.");
    setHintOk(true);
    focusScanner();
  };

  const removeCard = (index) => {
    const next = cardsRef.current.map((card, i) =>
      i === index ? { ...card, code: "" } : card
    );
    setCardsSafe(next);
    setHint("Cartela removida. Bipe novamente.");
    setHintOk(true);
    focusScanner();
  };

  return (
    <div className="grid two-col">
      <section className="card scan-hero">
        <div className="section-head">
          <h3 className="display" style={{ marginTop: 0, fontSize: 28 }}>Leitor de codigo de barras</h3>
          <span className={`badge ${listening ? "paid" : "pending"}`}>
            {listening ? "Leitor ativo" : "Pausado"}
          </span>
        </div>
        <div className="mode-switch">
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setQuery(null);
              setHint("Leitor pronto. Bipe a primeira cartela.");
              setHintOk(true);
            }}
          >
            Registrar bloco
          </button>
          <button
            type="button"
            className={mode === "lookup" ? "active" : ""}
            onClick={() => {
              setMode("lookup");
              setHint("Bipe qualquer cartela para consultar.");
              setHintOk(true);
            }}
          >
            Consultar cartela
          </button>
        </div>
        <p style={{ color: "var(--muted)" }}>
          Use o bipador USB. Ele envia o codigo e o Enter sozinho. Mantenha esta tela aberta e bipe as cartelas.
        </p>
        <form onSubmit={onScanSubmit}>
          <input
            ref={inputRef}
            name="code"
            className="scan-input"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="none"
            placeholder="AGUARDANDO CODIGO DE BARRAS"
            onFocus={() => setListening(true)}
          />
        </form>
        {mode === "register" ? (
          <>
            <div className="progress">
              <span style={{ width: `${(filled / totalNeeded) * 100}%` }} />
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              {filled}/{totalNeeded} lidas
              {nextIndex === settings.cardsPerBlock ? " · proxima e a cartela de brinde" : ""}
              {nextIndex >= 0 && nextIndex < settings.cardsPerBlock ? ` · proxima: cartela ${nextIndex + 1}` : ""}
            </p>
            <div className="scan-chips">
              {cards.map((card, i) => (
                <button
                  type="button"
                  key={i}
                  className={`chip ${card.isGift ? "gift" : ""} ${card.code ? "ok" : ""}`}
                  onClick={() => card.code && removeCard(i)}
                  title={card.code ? "Clique para remover e bipar de novo" : ""}
                >
                  {card.isGift ? "Brinde" : i + 1}. {card.code || "—"}
                </button>
              ))}
            </div>
          </>
        ) : query ? (
          <div className={`lookup-box ${query.found ? "found" : ""}`}>
            <strong>{query.code}</strong>
            {query.found ? (
              <p>
                Pessoa: {query.personName}<br />
                Bloco: {query.blockNumber}
                {query.isGift ? " · brinde" : ""}
              </p>
            ) : (
              <p>Esta cartela ainda nao entrou em nenhum bloco.</p>
            )}
          </div>
        ) : (
          <p className="hint-box">Bipe uma cartela para ver dono, bloco e se e brinde.</p>
        )}
        {hint ? <p className={hintOk ? "ok-msg" : "error"}>{hint}</p> : null}
        {mode === "register" ? (
          <div className="actions" style={{ marginTop: 16 }}>
            <button className="btn" disabled={!ready || busy} onClick={save}>
              {busy ? "Salvando..." : "Registrar bloco"}
            </button>
            <button className="btn ghost" type="button" onClick={resetCards}>
              Limpar bipagem
            </button>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h3 className="display" style={{ marginTop: 0 }}>Dados do pagamento</h3>
        <p className="hint-box">
          Preencha o nome e o lote. Depois clique no campo azul e bipe as 10 cartelas + 1 brinde.
        </p>
        <div className="form-grid" style={{ marginTop: 12 }}>
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
        <button className="btn ghost" type="button" onClick={focusScanner}>
          Voltar o foco para o leitor
        </button>
      </section>
    </div>
  );
}
