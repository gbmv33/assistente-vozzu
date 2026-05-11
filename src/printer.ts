// eslint-disable-next-line @typescript-eslint/no-require-imports
const { printer: ThermalPrinter, types, CharacterSet } = require("node-thermal-printer");

export interface PrintJob {
  text: string;
  paperSize: "58mm" | "80mm";
  vias: number;
  printerName?: string;
}

export interface PrinterInfo {
  name: string;
  isDefault: boolean;
}

export async function printJob(job: PrintJob, printerName: string): Promise<void> {
  const printer = new ThermalPrinter({
    type: types.EPSON,
    interface: `printer:${printerName}`,
    width: job.paperSize === "58mm" ? 32 : 42,
    characterSet: CharacterSet.PC860_PORTUGUESE,
    removeSpecialCharacters: false,
  });

  const lines = job.text.split("\n");
  for (const line of lines) {
    printer.println(line);
  }
  printer.cut();

  for (let i = 0; i < job.vias; i++) {
    await printer.execute();
  }
}

export async function printTestPage(
  paperSize: "58mm" | "80mm",
  vias: number,
  printerName: string
): Promise<void> {
  const w = paperSize === "58mm" ? 32 : 42;
  const div = "-".repeat(w);
  const text = [
    "VOZZU — TESTE DE IMPRESSÃO".padStart(Math.ceil((w + 22) / 2)),
    div,
    `Papel: ${paperSize}`,
    `Vias:  ${vias}`,
    div,
    "Se voce esta lendo isto,",
    "a impressao esta funcionando!",
    div,
  ].join("\n");

  await printJob({ text, paperSize, vias, printerName }, printerName);
}
