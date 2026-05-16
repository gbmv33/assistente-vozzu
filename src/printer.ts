import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { printer: ThermalPrinter, types, CharacterSet } = require("node-thermal-printer");

export interface PrintJob {
  text: string;
  paperSize: "58mm" | "80mm";
  vias: number;
}

// Sends raw ESC/POS bytes to a Windows printer via Win32 Print Spooler API.
// Avoids node-printer native module (requires electron-rebuild to work in Electron).
const PS_RAW_PRINT = `param([string]$Printer, [string]$DataFile)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WinSpooler {
    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool OpenPrinter(string n, ref IntPtr h, IntPtr d);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr h, int lv, ref DocInfo d);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr h, byte[] b, int n, ref int w);
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct DocInfo {
        public int sz;
        [MarshalAs(UnmanagedType.LPWStr)] public string doc;
        [MarshalAs(UnmanagedType.LPWStr)] public string output;
        [MarshalAs(UnmanagedType.LPWStr)] public string type;
    }
}
'@
$bytes = [System.IO.File]::ReadAllBytes($DataFile)
$h = [IntPtr]::Zero
if (-not [WinSpooler]::OpenPrinter($Printer, [ref]$h, [IntPtr]::Zero)) {
  throw "Nao foi possivel abrir a impressora: $Printer"
}
try {
  $di = New-Object WinSpooler+DocInfo
  $di.sz = [System.Runtime.InteropServices.Marshal]::SizeOf($di)
  $di.doc = 'Vozzu'
  $di.type = 'RAW'
  [WinSpooler]::StartDocPrinter($h, 1, [ref]$di) | Out-Null
  [WinSpooler]::StartPagePrinter($h) | Out-Null
  $wr = 0
  [WinSpooler]::WritePrinter($h, $bytes, $bytes.Length, [ref]$wr) | Out-Null
  [WinSpooler]::EndPagePrinter($h) | Out-Null
  [WinSpooler]::EndDocPrinter($h) | Out-Null
} finally {
  [WinSpooler]::ClosePrinter($h) | Out-Null
}`;

function sendRaw(printerName: string, data: Buffer): void {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dataFile = path.join(os.tmpdir(), `vozzu-${id}.bin`);
  const scriptFile = path.join(os.tmpdir(), `vozzu-${id}.ps1`);

  fs.writeFileSync(dataFile, data);
  fs.writeFileSync(scriptFile, PS_RAW_PRINT, "utf8");

  try {
    const res = spawnSync(
      "powershell",
      [
        "-NoProfile", "-NonInteractive",
        "-ExecutionPolicy", "Bypass",
        "-File", scriptFile,
        "-Printer", printerName,
        "-DataFile", dataFile,
      ],
      { windowsHide: true, timeout: 15000, encoding: "utf-8" as const }
    );
    if (res.status !== 0) {
      const errMsg =
        (res.stderr as string)?.trim() ||
        (res.stdout as string)?.trim() ||
        "Falha na impressão";
      throw new Error(errMsg);
    }
  } finally {
    try { fs.unlinkSync(dataFile); } catch { /* ignore */ }
    try { fs.unlinkSync(scriptFile); } catch { /* ignore */ }
  }
}

export async function printJob(job: PrintJob, printerName: string): Promise<void> {
  // interface: tcp evita carregar node-printer (módulo nativo ausente no Electron).
  // execute() nunca é chamado — usamos getBuffer() + PowerShell para enviar.
  const p = new ThermalPrinter({
    type: types.EPSON,
    interface: "tcp://127.0.0.1:1",
    width: job.paperSize === "58mm" ? 32 : 42,
    characterSet: CharacterSet.PC860_PORTUGUESE,
    removeSpecialCharacters: false,
  });

  for (const line of job.text.split("\n")) {
    p.println(line);
  }
  p.cut();

  const single: Buffer = p.getBuffer();
  // Concatenate N copies so the printer receives all vias in one job
  const payload = Buffer.concat(Array.from({ length: job.vias }, () => single));
  sendRaw(printerName, payload);
}
