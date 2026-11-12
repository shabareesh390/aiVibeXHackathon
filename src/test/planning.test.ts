import { describe, expect, it } from "vitest";
import { parseOrderText } from "@/services/parser";
import { SEED_MENU } from "@/mock/menu";
import { ratioToLoad } from "@/lib/load";

describe("order parser", () => {
  it("parses English with quantities and modifiers", () => {
    const r = parseOrderText("2 masala dosa and a filter coffee no sugar", SEED_MENU);
    expect(r.items).toEqual([
      { itemId: "masala-dosa", qty: 2, modifiers: [] },
      { itemId: "filter-coffee", qty: 1, modifiers: ["no sugar"] },
    ]);
  });
  it("parses Hinglish", () => {
    const r = parseOrderText("ek masala dosa aur chai", SEED_MENU);
    expect(r.items.map((i) => [i.itemId, i.qty])).toEqual([["masala-dosa", 1], ["masala-chai", 1]]);
  });
  it("asks which dosa when only 'dosa' is given", () => {
    const r = parseOrderText("do dosa", SEED_MENU);
    expect(r.items).toHaveLength(0);
    expect(r.unresolved[0]?.question).toBe("Which dosa?");
    expect(r.unresolved[0]?.qty).toBe(2);
    expect(r.unresolved[0]?.options).toEqual(["masala-dosa", "plain-dosa", "set-dosa"]);
  });
  it("reads a ready-by time", () => {
    const now = new Date(2026, 0, 1, 11, 0).getTime();
    const r = parseOrderText("samosa ready by 1 pm", SEED_MENU, now);
    expect(new Date(r.readyBy!).getHours()).toBe(13);
    expect(r.items[0]?.itemId).toBe("samosa");
  });
});

describe("load colors", () => {
  it("green below 60%, amber up to full, red when full", () => {
    expect(ratioToLoad(0.5)).toBe("green");
    expect(ratioToLoad(0.6)).toBe("amber");
    expect(ratioToLoad(1)).toBe("red");
  });
});
