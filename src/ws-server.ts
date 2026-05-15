import { WebSocketServer, WebSocket } from "ws";
import { execSync } from "child_process";
import { createServer as createHttpsServer } from "https";
import { printJob, printTestPage } from "./printer";

export interface WsServerConfig {
  port: number;
  portSecure: number;
  onClientChange: (count: number) => void;
}

// Certificado auto-assinado para 127.0.0.1 (válido 10 anos, gerado em 2026-05-15)
// O usuário confia uma vez via https://127.0.0.1:7338 → depois wss:// funciona sempre
const TLS_CERT = `-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgIUVnCktKUnbsrm0szawQEuSNJSdqswDQYJKoZIhvcNAQEL
BQAwKjESMBAGA1UEAwwJMTI3LjAuMC4xMRQwEgYDVQQKDAtWb3p6dSBMb2NhbDAe
Fw0yNjA1MTUwMzM3MzlaFw0zNjA1MTIwMzM3MzlaMCoxEjAQBgNVBAMMCTEyNy4w
LjAuMTEUMBIGA1UECgwLVm96enUgTG9jYWwwggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQCrJKIwImRlR6BOCjssnTQyuNCjQ0fe2McIvnl+TcBzhdjoxKoA
rJfVGjX3b9fatc/VwavRTL71d5uS1VqZ6tsy8SFjtpx171wNxeTu5wRXC1sp1jDM
+lSRWe32EEzkx9fcKUW5e4kmkoGRgN6CD9/+jkrBH+W5IZmXB10KxYcRduA2d7YB
VYEzXcAJVVb1bYrh+jf5pWYmh/zLEPy3PLV7LDMuwJO2oKEFOZAVN7ivh+F+Mo56
Md9cHOl+9WDKlPcFUZUaQUccxqhLbOjgN9JtPFkZR17BJAQx7QhGD24b9Jq9CRHq
RX65sLkDWODFpL9Mx7Xt7MlgntEKaN0WFvA9AgMBAAGjXzBdMA8GA1UdEQQIMAaH
BH8AAAEwCQYDVR0TBAIwADALBgNVHQ8EBAMCBaAwEwYDVR0lBAwwCgYIKwYBBQUH
AwEwHQYDVR0OBBYEFG9vYfiey2gmZpp8rFGtdDyQTw2pMA0GCSqGSIb3DQEBCwUA
A4IBAQB9WI4nl+0AsH0xarPbtHJUh1t60HQvYlcua2HTT29HauT05nYCP57DL9gj
7pEvj/s4gnrUqvmOB5Dv4/yi8L5yv0TA60PiROJtIKWNY+uCduqVlaqWJ6ih1/eO
Y1o2HcDHCmgQa1LqL4yJGC075lh8sreLlSGYCaE+KsthR44/nY2cxhrysj5OC7U7
bOB341vQsQUstfUNb9NRwTX2PBiSI9FObyMDByT//5GpXPiex988nTKR4+31b4Lt
nK/B5IHO6MyKe7LpALtPnfytOTRDViHmvv/tk3SP5hYzg79bTVFVnWb2ZlYtldK5
tpRDJe8gx/MUThXWvCC5vVwc0bnl
-----END CERTIFICATE-----`;

const TLS_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCrJKIwImRlR6BO
CjssnTQyuNCjQ0fe2McIvnl+TcBzhdjoxKoArJfVGjX3b9fatc/VwavRTL71d5uS
1VqZ6tsy8SFjtpx171wNxeTu5wRXC1sp1jDM+lSRWe32EEzkx9fcKUW5e4kmkoGR
gN6CD9/+jkrBH+W5IZmXB10KxYcRduA2d7YBVYEzXcAJVVb1bYrh+jf5pWYmh/zL
EPy3PLV7LDMuwJO2oKEFOZAVN7ivh+F+Mo56Md9cHOl+9WDKlPcFUZUaQUccxqhL
bOjgN9JtPFkZR17BJAQx7QhGD24b9Jq9CRHqRX65sLkDWODFpL9Mx7Xt7MlgntEK
aN0WFvA9AgMBAAECggEABiZb2aTyvJz1SridZb4EaSow/Rzm0UAy7sKBdSNwHfaa
U8r1XO7WyeaWN90CAa701/aMqQm79vAkXANkrRE+bTcy/vVJ7Ab85NXOozMT+djD
nt4+hK8eKNb1cRkm2jXAMP4erkqdJBCxrTvXQw80+l28m/H8fEmTzlSKaF+uudbf
h2BUAjnirqHLeOEegm/EaXghedEkjUaPandYud7EtJthy4d+aP6Avg8S9cLlkoze
zXlPJIEzj622Imu4RS6PcJ58K72wbCeeL5DFzpSUsSzR4mC54OJeIuLfevqgEKF+
lj7gzaMQ0q5qt7uhdFPnKvhm4jVFSLTAnOrPw51OFQKBgQDxasiFlec5EeqN1EG9
tVztR20oeaNgIHjS71tFhiUqKnGW7uhVOXcRB9mWVsOOLlYO3N+w1aWk2Pr7lAS/
JwAkdZfsn8nUQiN6U7mQxgID0GXYUj5l4njW9YGu3KnxMXQoc+efjCzzzYOgCVYH
SpvRGf1tlt8QvRtL0rK+Z7zYhwKBgQC1eyZJsAj6kV059fakD3GYy4SWaJGw+JFR
GQuSUTcBi6Mx8hbdXMcavqwRIibXMClOMLF7EVLvFYdDPJfaZMSxmrZreGqajF2S
SEFhhXWyKJOkoOwHXrI9g566EQIEqRv6vRF2OZXUU2tzZxzrGGaUh9ganiE8EMIZ
huk+64uWGwKBgQDDtcaTjR+iw2R70AvviDyqWxIiEuIgRpLMpaA/b21njnsBWfJd
TLW6x7tcRkBIXkYDzIlHKRwc1I47LxbeA/b4l6AvAqay/V8XhxJTTEJL50D5KktN
e1htIyAbquXWEzpQpQ2r6Q50IzJGperpBFHnJQOvOPTi8/tR76BZ/W05twKBgHR/
Z2aqIDlpEyVf5UIPv+ZLzwMWgV/PUMl0gF8ez2aoksw/EbpsEkvy1lXxTGmauwk8
bNIJnulnMntQ7FH/mdxA6pU2qYgoTvDWfVHy8Ei7j3uA6cMZYOXoFf5vaJJBVHqy
4AC6mpnAKxvbt06bTU5PncQIemEqiM8GMbh4UBS9AoGBAI4BUwQ/H1Sze7H6wstL
0Gg4rIBLSuAdX3Tn0329EfHR1xakFiCT+NWKUtqlyMnN9JZvil5L4f1sWdJ3fDuQ
Ueg7IFNfFSB1CujYR2aHtQBYFiNAvSYyK64aA2anjudh3xuhBwKC+NMfcPbbx+a4
hUGTiFXvMv5Eyc9sehagLPTl
-----END PRIVATE KEY-----`;

function getInstalledPrinters(): string[] {
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

async function handleMessage(ws: WebSocket, data: Buffer) {
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
}

export function startWsServer(config: WsServerConfig): { wss: WebSocketServer; wssSecure: WebSocketServer } {
  const { port, portSecure, onClientChange } = config;

  // WS simples (HTTP) — porta 7337
  const wss = new WebSocketServer({ port, host: "127.0.0.1" });

  // WSS seguro (HTTPS) — porta 7338
  // O servidor HTTPS também responde GET / com uma página de confirmação (para confiança do cert)
  const httpsServer = createHttpsServer(
    { key: TLS_KEY, cert: TLS_CERT },
    (req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<!DOCTYPE html><html><head><meta charset=utf-8><title>Assistente Vozzu</title>" +
        "<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fa}" +
        ".box{text-align:center;padding:32px;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08)}" +
        "h2{color:#16a34a;margin:0 0 8px}p{color:#64748b;margin:0}</style></head>" +
        "<body><div class=box><h2>✓ Assistente Vozzu</h2><p>Certificado confiável. Pode fechar esta aba.</p></div></body></html>"
      );
    }
  );
  const wssSecure = new WebSocketServer({ server: httpsServer });

  function attach(server: WebSocketServer) {
    server.on("connection", (ws: WebSocket) => {
      onClientChange((wss.clients.size) + (wssSecure.clients.size));
      ws.on("message", (data) => handleMessage(ws, data as Buffer));
      ws.on("close", () => onClientChange((wss.clients.size) + (wssSecure.clients.size)));
    });
  }

  attach(wss);
  attach(wssSecure);

  httpsServer.listen(portSecure, "127.0.0.1");

  return { wss, wssSecure };
}
