import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/main/ipc";

describe("parseCsv", () => {
  it("parses simple CSV rows", () => {
    const result = parseCsv("a,b,c\n1,2,3");
    expect(result).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("handles quoted fields with commas inside", () => {
    const result = parseCsv('"田中, 次郎",100,"東京都, 千代田区"');
    expect(result).toEqual([["田中, 次郎", "100", "東京都, 千代田区"]]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    const result = parseCsv('"say ""hello""",value');
    expect(result).toEqual([['say "hello"', "value"]]);
  });

  it("handles empty fields", () => {
    const result = parseCsv("a,,c");
    expect(result).toEqual([["a", "", "c"]]);
  });

  it("skips empty lines", () => {
    const result = parseCsv("a,b\n\nc,d\n");
    expect(result).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv("a,b\r\nc,d");
    expect(result).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("roundtrips with toCsvCell-style quoting", () => {
    // Simulates what toCsvCell produces: all values wrapped in quotes, internal quotes doubled
    const csv = '"V001","2026-04-01","管理部","設備費","支出","田中, 次郎","保守 ""契約""","128000","12800","備考"';
    const result = parseCsv(csv);
    expect(result).toEqual([
      ["V001", "2026-04-01", "管理部", "設備費", "支出", "田中, 次郎", '保守 "契約"', "128000", "12800", "備考"]
    ]);
  });
});
