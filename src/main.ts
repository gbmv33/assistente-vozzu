import { app, Tray, Menu, nativeImage, Notification } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import { startHttpServer } from "./ws-server";

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const HTTP_PORT = 7337;

interface Config {
  firstRun: boolean;
}

let tray: Tray | null = null;
let server: http.Server | null = null;

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
  const status = server ? `Online · porta ${HTTP_PORT}` : "Offline";

  const menu = Menu.buildFromTemplate([
    { label: "Assistente Vozzu", enabled: false },
    { label: status, enabled: false },
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
    new Notification({
      title: "Assistente Vozzu",
      body: server
        ? `Rodando na porta ${HTTP_PORT}`
        : "Servidor não está rodando",
      silent: true,
    }).show();
  });
}

app.whenReady().then(() => {
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
  server = startHttpServer(HTTP_PORT);
  rebuildTrayMenu();
});

app.on("window-all-closed", () => {
  // mantém rodando sem janelas
});

app.on("before-quit", () => {
  tray?.destroy();
  server?.close();
});
