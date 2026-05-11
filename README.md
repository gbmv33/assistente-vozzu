# Assistente Vozzu

App desktop (Electron) para impressão térmica local via WebSocket.

## Como funciona

O painel web do Vozzu conecta em `ws://localhost:7337`. O Assistente recebe os pedidos e os envia para a impressora térmica via ESC/POS.

## Mensagens WebSocket

```json
// Imprimir pedido
{ "type": "PRINT", "text": "...", "paperSize": "80mm", "vias": 1 }

// Teste de impressão
{ "type": "TEST_PRINT", "paperSize": "80mm", "vias": 1 }

// Ping/pong
{ "type": "PING" }
```

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
# Saída: dist-installer/Assistente Vozzu Setup.exe
```

## Gerar ícones

```bash
npm install sharp --save-dev
node scripts/gen-icons.js
# Gera renderer/assets/tray-icon.png (16x16)
# Gera build/icon-256.png → converter para .ico com ImageMagick:
# magick build/icon-256.png build/icon.ico
```
