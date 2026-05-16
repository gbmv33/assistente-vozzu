import * as http from "http";
import { execSync } from "child_process";
import { printJob } from "./printer";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
};

function fetchPrintersSync(): string[] {
  try {
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
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

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
            await printJob(
              { text: params.text, paperSize: params.paperSize, vias: params.vias },
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
