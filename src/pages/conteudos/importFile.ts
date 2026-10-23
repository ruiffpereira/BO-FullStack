import * as XLSX from "xlsx";
import { ImportRow } from "./model";

/** Linhas cruas da folha → linhas de importação válidas (key e value obrigatórios; cabeçalhos PT/EN, sem BOM). */
export function importRowsFromRaw(raw: Record<string, unknown>[]): { rows: ImportRow[]; skipped: number } {
  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of raw) {
    const n: Record<string, string> = {};
    for (const [k, v] of Object.entries(r))
      n[k.replace(/^\uFEFF/, "").toLowerCase().trim()] = String(v).trim();
    const key = n["key"] || "";
    const value = n["value"] || n["valor"] || "";
    if (!key || !value) {
      skipped++;
      continue;
    }
    rows.push({
      key,
      locale: n["locale"] || n["língua"] || n["lingua"] || null,
      value,
      type: n["type"] || n["tipo"] || "text",
      sectionName: n["section"] || n["secção"] || n["seccao"] || null,
      parentSectionName: n["parent"] || n["pai"] || null,
    });
  }
  return { rows, skipped };
}

export async function parseImportFile(file: File): Promise<{ rows: ImportRow[]; skipped: number }> {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  let wb: XLSX.WorkBook;
  if (isExcel) {
    const buffer = await file.arrayBuffer();
    wb = XLSX.read(buffer, { type: "array" });
  } else {
    const text = await file.text();
    wb = XLSX.read(text, { type: "string" });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
  return importRowsFromRaw(raw);
}

export function downloadCsvTemplate() {
    const csv =
      "﻿" +
      [
        "key,locale,value,type,section,parent",
        "hero.title,pt,O título principal,text,Hero,Homepage",
        "hero.image,pt,https://url.jpg,image,Hero,Homepage",
        "nav.home,pt,Início,text,Navegação,",
        "homepage.cta,pt,Saber mais,text,CTA,Hero",
      ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_cms.csv";
    a.click();
    URL.revokeObjectURL(url);
}
