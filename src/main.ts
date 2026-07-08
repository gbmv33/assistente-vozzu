import { app, Tray, Menu, nativeImage, Notification, shell } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import { autoUpdater } from "electron-updater";
import { startHttpServer } from "./ws-server";

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const HTTP_PORT = 7337;
const RELEASES_URL = "https://github.com/gbmv33/assistente-vozzu/releases/latest";

interface Config {
  firstRun: boolean;
}

let tray: Tray | null = null;
let server: http.Server | null = null;
// Só avisa que existe versão nova — nunca baixa/instala sozinho (sem
// certificado de assinatura de código, uma instalação silenciosa
// esbarraria no SmartScreen do Windows; melhor deixar o download manual,
// como já era, só que agora avisado em vez de precisar checar por conta).
let availableVersion: string | null = null;

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
    ...(availableVersion ? [
      { type: "separator" as const },
      {
        label: `Atualização disponível (v${availableVersion}) — Baixar`,
        click: () => { shell.openExternal(RELEASES_URL); },
      },
    ] : []),
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

function checkForUpdates(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.on("update-available", (info) => {
    availableVersion = info.version;
    rebuildTrayMenu();
    new Notification({
      title: "Atualização disponível — Assistente Vozzu",
      body: `Versão ${info.version} disponível. Clique aqui pra baixar.`,
      silent: false,
    }).on("click", () => shell.openExternal(RELEASES_URL))
      .show();
  });
  // Sem internet, repo privado temporariamente etc. — nunca incomoda o
  // usuário por causa disso, só loga pra investigar se precisar.
  autoUpdater.on("error", (err) => {
    console.error("Falha ao verificar atualização:", err);
  });
  autoUpdater.checkForUpdates().catch((err) => {
    console.error("Falha ao verificar atualização:", err);
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
  server.once("listening", () => rebuildTrayMenu());
  server.once("error", (err: NodeJS.ErrnoException) => {
    console.error("HTTP server error:", err);
    server = null;
    rebuildTrayMenu();
  });

  checkForUpdates();
});

app.on("window-all-closed", () => {
  // mantém rodando sem janelas
});

app.on("before-quit", () => {
  tray?.destroy();
  server?.close();
});
