import { WebSocketServer, WebSocket } from "ws";
import { execSync } from "child_process";
import { printJob, printTestPage } from "./printer";

export interface WsServerConfig {
  port: number;
  onClientChange: (count: number) => void;
}

function getInstalledPrinters(): string[] {
  try {
    // wmic foi removido no Windows 11 22H2+; usa PowerShell como fallback
    let out: string;
    try {
      out = execSync("wmic printer get name /format:list", { encoding: "utf-8", timeout: 5000 });
      return out
        .split(/\r?\n/)
        .filter((l) => l.startsWith("Name="))
        .map((l) => l.replace("Name=", "").trim())
        .filter(Boolean);
    } catch {
      out = execSync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
        { encoding: "utf-8", timeout: 5000 }
      );
      return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    }
  } catch {
    return [];
  }
}

export function startWsServer(config: WsServerConfig): WebSocketServer {
  const { port, onClientChange } = config;

  const wss = new WebSocketServer({ port, host: "127.0.0.1" });

  wss.on("connection", (ws: WebSocket) => {
    onClientChange(wss.clients.size);

    ws.on("message", async (data) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      const type = msg.type as string;

      try {
        if (type === "PING") {
          ws.send(JSON.stringify({ ok: true, type: "PONG" }));

        } else if (type === "GET_PRINTERS") {
          const printers = getInstalledPrinters();
          ws.send(JSON.stringify({ ok: true, type: "PRINTERS", printers }));

        } else if (type === "PRINT") {
          const printerName = (msg.printerName as string | undefined) ?? "";
          if (!printerName) {
            ws.send(JSON.stringify({ ok: false, error: "no_printer" }));
            return;
          }
          await printJob(
            {
              text: msg.text as string,
              paperSize: (msg.paperSize as "58mm" | "80mm") ?? "80mm",
              vias: (msg.vias as number) ?? 1,
            },
            printerName
          );
          ws.send(JSON.stringify({ ok: true }));

        } else if (type === "TEST_PRINT") {
          const printerName = (msg.printerName as string | undefined) ?? "";
          if (!printerName) {
            ws.send(JSON.stringify({ ok: false, error: "no_printer" }));
            return;
          }
          await printTestPage(
            (msg.paperSize as "58mm" | "80mm") ?? "80mm",
            (msg.vias as number) ?? 1,
            printerName
          );
          ws.send(JSON.stringify({ ok: true }));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ws.send(JSON.stringify({ ok: false, error: message }));
      }
    });

    ws.on("close", () => {
      onClientChange(wss.clients.size);
    });
  });

  return wss;
}
