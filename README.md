# Jubileu 25 anos — Sistema de Cartelas

Plataforma de controle de cartelas, lotes e pagamentos da Paroquia Nossa Senhora Aparecida (Maringa-PR), feita para o Jubileu de 25 anos.

O sistema registra cada bloco vendido com leitor de codigo de barras, guarda forma e dia do pagamento, calcula o financeiro e exporta planilha Excel.

## O que o sistema faz

- **Bipa cartelas** com leitor USB de codigo de barras
- Organiza as vendas por **lote**
- Controla **forma de pagamento**, **dia do pagamento** e **status** (pago ou pendente)
- Associa **nome da pessoa** a um **bloco**
- Cada bloco tem **10 cartelas + 1 de brinde**
- Mostra o caixa em tempo real: recebido, pendente e total esperado
- Exporta **planilha Excel** completa ou por lote

## Como funciona o bloco

Um bloco e a unidade de venda:

| Item | Quantidade |
| --- | --- |
| Cartelas vendidas | 10 |
| Cartela de brinde | 1 |
| Total bipado | 11 |

Fluxo sugerido no caixa:

1. Crie o lote (ex.: Comunidade Centro).
2. Informe o nome da pessoa, a forma e o dia do pagamento.
3. Bipe as 10 cartelas.
4. Bipe a 11a cartela (brinde).
5. Confirme o valor e registre o bloco.
6. Quando precisar, baixe o Excel.

O sistema recusa cartela repetida no mesmo bloco e cartela que ja pertence a outra pessoa.

## Telas

### Financeiro

Painel inicial do caixa:

- Valor recebido
- Valor pendente
- Total esperado
- Blocos pagos / total
- Tabela por forma de pagamento (PIX, dinheiro, cartao, transferencia, boleto)
- Tabela de lotes com recebido e pendente
- Ultimos pagamentos

### Bipador

Tela principal de operacao, feita para leitor USB de codigo de barras.

Dois modos:

- **Registrar bloco** — bipe 10 cartelas + 1 brinde e salve o pagamento
- **Consultar cartela** — bipe qualquer codigo para ver se ja tem dono, bloco e se e brinde

O leitor envia os numeros e o Enter sozinho. O sistema captura essa sequencia rapida, da um som de confirmacao e mostra a cartela na lista.

Dicas de uso:

- Clique no campo azul **AGUARDANDO CODIGO DE BARRAS** antes de comecar
- Se precisar preencher nome ou lote, preencha e volte o foco no campo azul
- Clique em uma cartela ja lida para remove-la e bipar de novo
- Use **Limpar bipagem** para recomeçar o bloco atual

### Lotes

Cadastro dos grupos de venda (comunidade, semana, campanha etc.).

Em cada lote voce informa:

- Nome
- Valor padrao do bloco (R$)
- Observacoes

Depois pode exportar o Excel so daquele lote.

### Tabela de pagamentos

Lista financeira completa, com filtros:

- Nome, lote ou codigo da cartela
- Lote
- Status (pago / pendente)
- Forma de pagamento

Colunas da tabela:

- Pessoa
- Numero do bloco
- Lote
- 10 cartelas
- Brinde
- Forma
- Dia
- Valor
- Status (clique para alternar pago/pendente)

## Exportacao Excel

O botao **Baixar Excel** gera um arquivo `.xlsx` com duas abas:

**Financeiro**

- Lote
- Bloco
- Nome
- Cartelas (10)
- Brinde
- Forma de pagamento
- Dia do pagamento
- Valor (R$)
- Status
- Observacoes

**Resumo**

- Quantidade de lotes, blocos, pagos e pendentes
- Total recebido, pendente e esperado
- Cartelas vendidas e brindes
- Recebido por forma de pagamento

Arquivos gerados:

- `jubileu-financeiro.xlsx` — tudo
- `jubileu-financeiro-lote.xlsx` — somente o lote filtrado

## Requisitos

- Node.js 18 ou superior
- npm
- Leitor de codigo de barras USB configurado como teclado (HID), com sufixo Enter (padrao da maioria dos leitores)

## Como executar

No computador local:

```bash
git clone https://github.com/andreezxs/sistema-cartela.git
cd sistema-cartela
```

Instale as dependencias:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Suba o backend (porta 3001):

```bash
cd backend
npm start
```

Em outro terminal, suba o frontend (porta 5173):

```bash
cd frontend
npm run dev
```

Abra `http://localhost:5173`.

O frontend encaminha `/api` para o backend em `http://127.0.0.1:3001`.

### Script unico

Na raiz do projeto:

```bash
chmod +x start.sh
./start.sh
```

O script inicia a API e em seguida o Vite.

## Estrutura do projeto

```text
sistema-cartela/
  backend/
    server.js          API Express (lotes, blocos, bipagem, Excel)
    package.json
  frontend/
    index.html
    vite.config.js     proxy /api e allowedHosts
    public/logo.png    logo do Jubileu 25 anos
    src/
      App.jsx
      api.js
      format.js
      styles.css
      useBarcodeScanner.js
      pages/
        Dashboard.jsx
        ScanPage.jsx
        LotsPage.jsx
        BlocksPage.jsx
  start.sh
  package.json
  README.md
```

## API

Base: `http://localhost:3001/api`

| Metodo | Rota | Descricao |
| --- | --- | --- |
| GET | `/meta` | Formas de pagamento e regras do bloco |
| GET | `/dashboard` | Totais financeiros e ultimos registros |
| GET | `/lots` | Lista de lotes com recebido/pendente |
| POST | `/lots` | Cria lote (`name`, `notes`, `pricePerBlock`) |
| PATCH | `/lots/:id` | Atualiza lote |
| GET | `/blocks` | Lista blocos (`lotId`, `q`, `paid`, `paymentMethod`) |
| POST | `/blocks` | Registra bloco com 11 cartelas |
| PATCH | `/blocks/:id` | Atualiza nome, pagamento, valor ou status |
| POST | `/scan/check` | Consulta se o codigo ja tem dono |
| GET | `/export.xlsx` | Baixa Excel (`lotId` opcional) |
| GET | `/health` | Saude da API |

### Exemplo de bloco

```json
{
  "lotId": "lot_...",
  "personName": "Maria Souza",
  "paymentMethod": "pix",
  "paymentDate": "2026-10-19",
  "paid": true,
  "amount": 50,
  "notes": "",
  "cards": [
    { "code": "1001", "isGift": false },
    { "code": "1002", "isGift": false }
  ]
}
```

As 10 primeiras cartelas sao as vendidas. A ultima deve ser o brinde (`isGift: true`).

Formas de pagamento aceitas:

- `pix`
- `dinheiro`
- `cartao_credito`
- `cartao_debito`
- `transferencia`
- `boleto`

## Dados

Os registros ficam em `backend/data.json` (arquivo local, criado automaticamente).

Esse arquivo nao vai para o Git. Se quiser backup, copie o `data.json` para outro lugar.

## Identidade visual

Cores da logo do Jubileu 25 anos:

- Azul-marinho `#0B2A6B`
- Dourado `#C9A227`
- Azul-ceu `#7EC8E8`

A logo aparece no menu lateral.

## Stack

- Frontend: React 18 + Vite
- Backend: Node.js + Express
- Planilha: ExcelJS
- Persistencia: JSON local

## Licenca

Uso interno da Paroquia Nossa Senhora Aparecida — Maringa-PR.
