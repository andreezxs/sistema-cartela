const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PAYMENT_METHODS = [
  { id: "pix", label: "PIX" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "cartao_credito", label: "Cartao de credito" },
  { id: "cartao_debito", label: "Cartao de debito" },
  { id: "transferencia", label: "Transferencia" },
  { id: "boleto", label: "Boleto" },
];

function emptyStore() {
  return {
    lots: [],
    blocks: [],
    scanSessions: [],
    settings: { cardsPerBlock: 10, giftPerBlock: 1, defaultAmount: 50 },
  };
}

function toMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function methodLabel(id) {
  const found = PAYMENT_METHODS.find((m) => m.id === id);
  return found ? found.label : id;
}

function moneyOf(block) {
  return toMoney(block && block.amount);
}

function loadStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const initial = emptyStore();
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return emptyStore();
  }
}

function saveStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function findCardOwner(store, code) {
  const normalized = normalizeCode(code);
  for (const block of store.blocks) {
    const match = (block.cards || []).find((c) => normalizeCode(c.code) === normalized);
    if (match) {
      return { block, card: match };
    }
  }
  return null;
}

function getLot(store, lotId) {
  return store.lots.find((l) => l.id === lotId);
}

app.get("/api/meta", (_req, res) => {
  const store = loadStore();
  res.json({
    paymentMethods: PAYMENT_METHODS,
    settings: store.settings,
  });
});

app.get("/api/dashboard", (_req, res) => {
  const store = loadStore();
  const paid = store.blocks.filter((b) => b.paid);
  const pending = store.blocks.filter((b) => !b.paid);
  const totalCards = store.blocks.reduce((sum, b) => sum + (b.cards || []).length, 0);
  const giftCards = store.blocks.reduce(
    (sum, b) => sum + (b.cards || []).filter((c) => c.isGift).length,
    0
  );
  const received = paid.reduce((sum, b) => sum + moneyOf(b), 0);
  const pendingAmount = pending.reduce((sum, b) => sum + moneyOf(b), 0);
  const byMethod = PAYMENT_METHODS.map((method) => {
    const items = paid.filter((b) => b.paymentMethod === method.id);
    return {
      id: method.id,
      label: method.label,
      count: items.length,
      amount: items.reduce((sum, b) => sum + moneyOf(b), 0),
    };
  });
  const recent = store.blocks
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map((b) => ({
      ...b,
      lotName: (getLot(store, b.lotId) || {}).name || "",
    }));
  res.json({
    lots: store.lots.length,
    blocks: store.blocks.length,
    paidBlocks: paid.length,
    pendingBlocks: pending.length,
    totalCards,
    giftCards,
    paidCards: paid.reduce((sum, b) => sum + (b.cards || []).filter((c) => !c.isGift).length, 0),
    received,
    pendingAmount,
    expected: received + pendingAmount,
    byMethod,
    recent,
  });
});

app.get("/api/lots", (_req, res) => {
  const store = loadStore();
  const lots = store.lots
    .map((lot) => {
      const blocks = store.blocks.filter((b) => b.lotId === lot.id);
      return {
        ...lot,
        blockCount: blocks.length,
        cardCount: blocks.reduce((sum, b) => sum + (b.cards || []).length, 0),
        paidCount: blocks.filter((b) => b.paid).length,
        received: blocks.filter((b) => b.paid).reduce((sum, b) => sum + moneyOf(b), 0),
        pendingAmount: blocks.filter((b) => !b.paid).reduce((sum, b) => sum + moneyOf(b), 0),
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(lots);
});

app.post("/api/lots", (req, res) => {
  const { name, notes, pricePerBlock } = req.body || {};
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return res.status(400).json({ error: "Informe o nome do lote." });
  }
  const store = loadStore();
  if (store.lots.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(409).json({ error: "Ja existe um lote com esse nome." });
  }
  const lot = {
    id: uid("lot"),
    name: trimmed,
    notes: String(notes || "").trim(),
    pricePerBlock: toMoney(pricePerBlock != null ? pricePerBlock : store.settings.defaultAmount),
    createdAt: new Date().toISOString(),
  };
  store.lots.push(lot);
  saveStore(store);
  res.status(201).json(lot);
});

app.patch("/api/lots/:id", (req, res) => {
  const store = loadStore();
  const lot = getLot(store, req.params.id);
  if (!lot) return res.status(404).json({ error: "Lote nao encontrado." });
  if (req.body.name != null) {
    const trimmed = String(req.body.name).trim();
    if (!trimmed) return res.status(400).json({ error: "Nome invalido." });
    lot.name = trimmed;
  }
  if (req.body.notes != null) lot.notes = String(req.body.notes).trim();
  if (req.body.pricePerBlock != null) lot.pricePerBlock = toMoney(req.body.pricePerBlock);
  saveStore(store);
  res.json(lot);
});

app.get("/api/blocks", (req, res) => {
  const store = loadStore();
  const { lotId, q, paid, paymentMethod } = req.query;
  let list = store.blocks.slice();
  if (lotId) list = list.filter((b) => b.lotId === lotId);
  if (paid === "true") list = list.filter((b) => b.paid);
  if (paid === "false") list = list.filter((b) => !b.paid);
  if (paymentMethod) list = list.filter((b) => b.paymentMethod === paymentMethod);
  if (q) {
    const term = String(q).toLowerCase();
    list = list.filter((b) => {
      const lot = getLot(store, b.lotId);
      const hay = [
        b.personName,
        b.blockNumber,
        lot && lot.name,
        ...(b.cards || []).map((c) => c.code),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }
  const enriched = list
    .map((b) => ({
      ...b,
      lotName: (getLot(store, b.lotId) || {}).name || "",
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(enriched);
});

app.post("/api/blocks", (req, res) => {
  const {
    lotId,
    personName,
    paymentMethod,
    paymentDate,
    paid,
    cards,
    notes,
    amount,
  } = req.body || {};

  const store = loadStore();
  const lot = getLot(store, lotId);
  if (!lot) return res.status(400).json({ error: "Selecione um lote valido." });

  const name = String(personName || "").trim();
  if (!name) return res.status(400).json({ error: "Informe o nome da pessoa." });

  const method = String(paymentMethod || "").trim();
  if (!PAYMENT_METHODS.some((m) => m.id === method)) {
    return res.status(400).json({ error: "Forma de pagamento invalida." });
  }

  const date = String(paymentDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Informe o dia do pagamento." });
  }

  const incoming = Array.isArray(cards) ? cards : [];
  const expected = store.settings.cardsPerBlock + store.settings.giftPerBlock;
  if (incoming.length !== expected) {
    return res.status(400).json({
      error: `Cada bloco precisa de ${store.settings.cardsPerBlock} cartelas + ${store.settings.giftPerBlock} brinde (${expected} no total).`,
    });
  }

  const normalizedCards = incoming.map((c, index) => {
    const code = normalizeCode(c && c.code);
    return {
      code,
      isGift: Boolean(c && c.isGift) || index === store.settings.cardsPerBlock,
    };
  });

  if (normalizedCards.some((c) => !c.code)) {
    return res.status(400).json({ error: "Todas as cartelas precisam de codigo." });
  }

  const unique = new Set(normalizedCards.map((c) => c.code));
  if (unique.size !== normalizedCards.length) {
    return res.status(400).json({ error: "Ha cartelas duplicadas neste bloco." });
  }

  for (const card of normalizedCards) {
    const owner = findCardOwner(store, card.code);
    if (owner) {
      return res.status(409).json({
        error: `Cartela ${card.code} ja pertence a ${owner.block.personName}.`,
      });
    }
  }

  const giftCount = normalizedCards.filter((c) => c.isGift).length;
  if (giftCount !== store.settings.giftPerBlock) {
    return res.status(400).json({
      error: `O bloco precisa ter exatamente ${store.settings.giftPerBlock} cartela de brinde.`,
    });
  }

  const lotBlocks = store.blocks.filter((b) => b.lotId === lotId);
  const blockNumber = lotBlocks.length + 1;

  const blockAmount =
    amount == null || amount === ""
      ? toMoney(lot.pricePerBlock != null ? lot.pricePerBlock : store.settings.defaultAmount)
      : toMoney(amount);

  const block = {
    id: uid("blk"),
    lotId,
    blockNumber,
    personName: name,
    paymentMethod: method,
    paymentDate: date,
    paid: paid !== false,
    amount: blockAmount,
    notes: String(notes || "").trim(),
    cards: normalizedCards,
    createdAt: new Date().toISOString(),
  };

  store.blocks.push(block);
  saveStore(store);
  res.status(201).json({
    ...block,
    lotName: lot.name,
  });
});

app.patch("/api/blocks/:id", (req, res) => {
  const store = loadStore();
  const block = store.blocks.find((b) => b.id === req.params.id);
  if (!block) return res.status(404).json({ error: "Bloco nao encontrado." });

  if (req.body.personName != null) {
    const name = String(req.body.personName).trim();
    if (!name) return res.status(400).json({ error: "Nome invalido." });
    block.personName = name;
  }
  if (req.body.paymentMethod != null) {
    if (!PAYMENT_METHODS.some((m) => m.id === req.body.paymentMethod)) {
      return res.status(400).json({ error: "Forma de pagamento invalida." });
    }
    block.paymentMethod = req.body.paymentMethod;
  }
  if (req.body.paymentDate != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.paymentDate))) {
      return res.status(400).json({ error: "Data invalida." });
    }
    block.paymentDate = req.body.paymentDate;
  }
  if (req.body.paid != null) block.paid = Boolean(req.body.paid);
  if (req.body.amount != null) block.amount = toMoney(req.body.amount);
  if (req.body.notes != null) block.notes = String(req.body.notes).trim();

  saveStore(store);
  const lot = getLot(store, block.lotId);
  res.json({ ...block, lotName: lot ? lot.name : "" });
});

app.post("/api/scan/check", (req, res) => {
  const code = normalizeCode(req.body && req.body.code);
  if (!code) return res.status(400).json({ error: "Codigo vazio." });
  const store = loadStore();
  const owner = findCardOwner(store, code);
  if (owner) {
    return res.json({
      available: false,
      code,
      owner: {
        personName: owner.block.personName,
        blockNumber: owner.block.blockNumber,
        lotId: owner.block.lotId,
        isGift: owner.card.isGift,
      },
    });
  }
  res.json({ available: true, code });
});

app.get("/api/export.xlsx", async (req, res) => {
  const store = loadStore();
  const { lotId } = req.query;
  let blocks = store.blocks.slice();
  if (lotId) blocks = blocks.filter((b) => b.lotId === lotId);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Jubileu 25 Anos";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Financeiro");
  sheet.columns = [
    { header: "Lote", key: "lot", width: 22 },
    { header: "Bloco", key: "block", width: 10 },
    { header: "Nome", key: "name", width: 28 },
    { header: "Cartelas (10)", key: "cards", width: 42 },
    { header: "Brinde", key: "gift", width: 16 },
    { header: "Forma de pagamento", key: "method", width: 22 },
    { header: "Dia do pagamento", key: "date", width: 18 },
    { header: "Valor (R$)", key: "amount", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Observacoes", key: "notes", width: 28 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B2A6B" },
  };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const sorted = blocks.sort((a, b) => {
    const lotA = (getLot(store, a.lotId) || {}).name || "";
    const lotB = (getLot(store, b.lotId) || {}).name || "";
    if (lotA !== lotB) return lotA.localeCompare(lotB, "pt-BR");
    return a.blockNumber - b.blockNumber;
  });

  for (const block of sorted) {
    const lot = getLot(store, block.lotId);
    const paidCards = (block.cards || []).filter((c) => !c.isGift).map((c) => c.code);
    const gift = (block.cards || []).filter((c) => c.isGift).map((c) => c.code);
    const row = sheet.addRow({
      lot: lot ? lot.name : "",
      block: block.blockNumber,
      name: block.personName,
      cards: paidCards.join(", "),
      gift: gift.join(", "),
      method: methodLabel(block.paymentMethod),
      date: block.paymentDate.split("-").reverse().join("/"),
      amount: moneyOf(block),
      status: block.paid ? "Pago" : "Pendente",
      notes: block.notes || "",
    });
    row.getCell("amount").numFmt = '"R$" #,##0.00';
    if (!block.paid) {
      row.getCell("status").font = { color: { argb: "FFB45309" }, bold: true };
    } else {
      row.getCell("status").font = { color: { argb: "FF047857" }, bold: true };
    }
  }

  const summary = workbook.addWorksheet("Resumo");
  summary.columns = [
    { header: "Indicador", key: "k", width: 32 },
    { header: "Valor", key: "v", width: 18 },
  ];
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B2A6B" },
  };
  const paid = blocks.filter((b) => b.paid);
  const received = paid.reduce((s, b) => s + moneyOf(b), 0);
  const pendingAmount = blocks.filter((b) => !b.paid).reduce((s, b) => s + moneyOf(b), 0);
  summary.addRow({ k: "Lotes no filtro", v: new Set(blocks.map((b) => b.lotId)).size });
  summary.addRow({ k: "Blocos", v: blocks.length });
  summary.addRow({ k: "Blocos pagos", v: paid.length });
  summary.addRow({ k: "Blocos pendentes", v: blocks.length - paid.length });
  summary.addRow({ k: "Total recebido (R$)", v: received });
  summary.addRow({ k: "Total pendente (R$)", v: pendingAmount });
  summary.addRow({ k: "Total esperado (R$)", v: received + pendingAmount });
  summary.addRow({
    k: "Cartelas vendidas",
    v: blocks.reduce((s, b) => s + (b.cards || []).filter((c) => !c.isGift).length, 0),
  });
  summary.addRow({
    k: "Cartelas brinde",
    v: blocks.reduce((s, b) => s + (b.cards || []).filter((c) => c.isGift).length, 0),
  });
  for (const method of PAYMENT_METHODS) {
    const items = paid.filter((b) => b.paymentMethod === method.id);
    summary.addRow({
      k: `Recebido via ${method.label} (R$)`,
      v: items.reduce((s, b) => s + moneyOf(b), 0),
    });
  }
  summary.getCell("B5").numFmt = '"R$" #,##0.00';
  summary.getCell("B6").numFmt = '"R$" #,##0.00';
  summary.getCell("B7").numFmt = '"R$" #,##0.00';

  const filename = lotId ? "jubileu-financeiro-lote.xlsx" : "jubileu-financeiro.xlsx";
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CartelaPay API on ${PORT}`);
});
