import { app, Tray, Menu, nativeImage, Notification } from "electron";
import * as path from "path";
import * as fs from "fs";
import { startWsServer } from "./ws-server";
import type { WebSocketServer } from "ws";

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const WS_PORT = 7337;

interface Config {
  firstRun: boolean;
}

let tray: Tray | null = null;
let wss: WebSocketServer | null = null;
let clientCount = 0;

function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {/* use default */}
  return { firstRun: true };
}

function saveConfig(c: Config): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2));
}

function rebuildTrayMenu(): void {
  if (!tray) return;
  const running = !!wss;
  const status = running
    ? `Online · ${clientCount} painel(is) conectado(s)`
    : "Offline";

  const menu = Menu.buildFromTemplate([
    { label: "Assistente Vozzu", enabled: false },
    { label: status, enabled: false },
    { label: `Porta: ${WS_PORT}`, enabled: false },
    { type: "separator" },
    { label: "Sair", click: () => { app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`Assistente Vozzu — ${status}`);
}

function createTray(): void {
  const iconPath = path.join(__dirname, "..", "build", "tray.png");
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  rebuildTrayMenu();

  tray.on("double-click", () => {
    // sem janela — notifica o status via balloon
    new Notification({
      title: "Assistente Vozzu",
      body: wss
        ? `Rodando na porta ${WS_PORT} · ${clientCount} painel(is) conectado(s)`
        : "Servidor não está rodando",
      silent: true,
    }).show();
  });
}

function startServer(): void {
  wss = startWsServer({
    port: WS_PORT,
    onClientChange: (count) => {
      clientCount = count;
      rebuildTrayMenu();
    },
  });
}

app.whenReady().then(() => {
  // Impede que o app apareça no Dock/Taskbar — apenas bandeja
  app.setAppUserModelId("com.vozzu.assistente");

  const config = loadConfig();
  if (config.firstRun) {
    app.setLoginItemSettings({ openAtLogin: true });
    saveConfig({ ...config, firstRun: false });
    new Notification({
      title: "Assistente Vozzu instalado!",
      body: "Rodando em segundo plano. Configure a impressora no painel do Vozzu.",
      silent: false,
    }).show();
  }

  createTray();
  startServer();
});

app.on("window-all-closed", () => {
  // mantém rodando sem janelas
});

app.on("before-quit", () => {
  tray?.destroy();
  wss?.close();
});
