import * as http from "http";
import { spawnSync } from "child_process";
import { printJob } from "./printer";

// Só o painel Vozzu (e localhost em dev) pode falar com o assistente local —
// senão qualquer site aberto no navegador do lojista poderia imprimir e
// enumerar impressoras.
const ALLOWED_ORIGINS = [
  "https://vozzu.com.br",
  "https://www.vozzu.com.br",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function corsHeadersFor(origin: string | undefined): Record<string, string> {
  const allowed =
    !!origin &&
    (ALLOWED_ORIGINS.includes(origin) ||
      /^https:\/\/[a-z0-9-]+\.vozzu\.com\.br$/i.test(origin));

  return {
    "Access-Control-Allow-Origin": allowed ? (origin as string) : "https://vozzu.com.br",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
  };
}

const PS_OPTS = {
  encoding: "utf-8" as const,
  timeout: 8000,
  windowsHide: true,
};

function fetchPrintersSync(): string[] {
  // Get-CimInstance não depende do módulo PrintManagement — funciona mesmo
  // quando o Electron sobe com o Windows sem o PSModulePath completo.
  // WMIC foi removido do Windows 11 24H2+.
  const cim = spawnSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command",
     "Get-CimInstance -ClassName Win32_Printer | Select-Object -ExpandProperty Name"],
    PS_OPTS
  );
  if (cim.status === 0 && cim.stdout) {
    const names = cim.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (names.length > 0) return names;
  }

  // Fallback: Get-Printer (requer módulo PrintManagement)
  const gp = spawnSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command",
     "Get-Printer | Select-Object -ExpandProperty Name"],
    PS_OPTS
  );
  if (gp.status === 0 && gp.stdout) {
    const names = gp.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (names.length > 0) return names;
  }

  return [];
}

// Cache populado no startup; refresh a cada 60s em background thread
let cachedPrinters: string[] = [];

function refreshPrinterCache(): void {
  setImmediate(() => {
    cachedPrinters = fetchPrintersSync();
  });
}

export function startHttpServer(port: number): http.Server {
  // Popula cache imediatamente ao iniciar o servidor
  refreshPrinterCache();
  setInterval(refreshPrinterCache, 60_000).unref();

  const server = http.createServer((req, res) => {
    Object.entries(corsHeadersFor(req.headers.origin)).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url?.split("?")[0] ?? "/";

    if (req.method === "GET" && url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "GET" && url === "/printers") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, printers: cachedPrinters }));
      return;
    }

    if (req.method === "POST" && url === "/print") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        (async () => {
          try {
            const params = JSON.parse(body) as {
              text: string;
              printerName: string;
              paperSize: "58mm" | "80mm";
              vias: number;
            };
            if (!params.printerName) throw new Error("no_printer");
            const vias = Math.min(Math.max(Number(params.vias) || 1, 1), 5);
            const paperSize = params.paperSize === "58mm" ? "58mm" : "80mm";
            await printJob(
              { text: String(params.text ?? ""), paperSize, vias },
              params.printerName
            );
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        })();
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, "127.0.0.1");
  return server;
}
