# Assistente Vozzu

App desktop (Electron) para impressão térmica local. Roda em segundo plano na
bandeja e expõe uma pequena API HTTP em `http://localhost:7337` (apenas
`127.0.0.1`) que o painel web do Vozzu chama para imprimir comandas.

## Como funciona

O painel web do Vozzu faz `fetch` para `http://localhost:7337`. Por segurança,
o servidor só aceita requisições com `Origin` do Vozzu (`*.vozzu.com.br`) ou de
`localhost:3000` em desenvolvimento.

## API HTTP

```text
GET  /            → { ok: true }                         # health check
GET  /printers    → { ok: true, printers: ["...", ...] } # impressoras instaladas (Windows)
POST /print       → { ok: true } | { ok: false, error }  # imprime
```

Corpo do `POST /print`:

```json
{
  "text": "conteúdo da comanda (texto puro)",
  "printerName": "Nome da impressora",
  "paperSize": "80mm",
  "vias": 1
}
```

`paperSize` aceita `"58mm"` ou `"80mm"` (default `80mm`); `vias` é limitado a 1–5.
A impressão envia bytes ESC/POS crus à impressora via Win32 Print Spooler
(PowerShell), sem depender de módulos nativos.

## Desenvolvimento

```bash
npm install
npm run build   # compila TypeScript
npm start       # abre o Electron
```

## Gerar instalador (.exe)

```bash
# Antes: colocar um icon.ico em build/
npm run dist
# Saída: dist-installer/Assistente-Vozzu-Setup.exe
```

## Gerar ícones

```bash
npm install sharp --save-dev
node scripts/gen-icons.js
# Gera build/tray.png (ícone da bandeja) e build/icon-256.png
# Converter para .ico com ImageMagick:
# magick build/icon-256.png build/icon.ico
```
