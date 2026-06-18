import * as yaml from "js-yaml";
import * as fs from "fs";
import { Page } from "playwright";

interface PageDef { url: string; }
interface ElementDef { selector: string; type: string; }
interface DictionaryData {
  pages: Record<string, PageDef>;
  elements: Record<string, ElementDef>;
}

export class UIDictionary {
  private pages: Record<string, PageDef>;
  private elements: Record<string, ElementDef>;

  constructor(dictPath: string) {
    const content = fs.readFileSync(dictPath, "utf-8");
    const data = yaml.load(content) as DictionaryData;
    this.pages = data.pages || {};
    this.elements = data.elements || {};
  }

  resolveUrl(name: string): string {
    if (this.pages[name]) return this.pages[name].url;
    if (name.startsWith("http")) return name;
    throw new Error(`[UIDictionary] 페이지 '${name}'가 등록되지 않았습니다. ui_dictionary.yaml을 확인하세요.`);
  }

  resolveSelector(name: string): string {
    if (this.elements[name]) return this.elements[name].selector;
    if (/^[#.\[a-zA-Z]/.test(name)) return name;
    throw new Error(`[UIDictionary] 엘리먼트 '${name}'가 등록되지 않았습니다. ui_dictionary.yaml을 확인하세요.`);
  }

  getPageNames(): string[] { return Object.keys(this.pages); }
  getElementNames(): string[] { return Object.keys(this.elements); }
}

export class DSLParser {
  private dict: UIDictionary;
  private ACTION_RE = /^(\w+)\((.*)\)$/s;

  constructor(dict: UIDictionary) {
    this.dict = dict;
  }

  async execute(page: Page, dsl: string): Promise<void> {
    const actions = dsl.split("->").map((s) => s.trim()).filter(Boolean);
    for (const raw of actions) {
      console.log(`    ▷ ${raw}`);
      await this.dispatch(page, raw);
    }
  }

  private splitArgs(raw: string): string[] {
    const args: string[] = [];
    let current = "";
    let inQuote = false;
    let quoteChar = "";
    for (const ch of raw) {
      if ((ch === '"' || ch === "'") && !inQuote) { inQuote = true; quoteChar = ch; }
      else if (inQuote && ch === quoteChar) { inQuote = false; }
      else if (ch === "," && !inQuote) {
        args.push(current.trim().replace(/^['"]|['"]$/g, "")); current = ""; continue;
      }
      current += ch;
    }
    if (current.trim()) args.push(current.trim().replace(/^['"]|['"]$/g, ""));
    return args;
  }

  private async dispatch(page: Page, raw: string): Promise<void> {
    const match = this.ACTION_RE.exec(raw);
    if (!match) throw new SyntaxError(`[DSL] 파싱 실패: '${raw}'`);

    const cmd = match[1];
    const args = this.splitArgs(match[2] || "");

    switch (cmd) {
      case "goto":
        await page.goto(this.dict.resolveUrl(args[0]), { waitUntil: "networkidle", timeout: 30000 });
        break;
      case "click":
        await page.locator(this.dict.resolveSelector(args[0])).click({ timeout: 10000 });
        break;
      case "input":
        await page.locator(this.dict.resolveSelector(args[0])).fill(args[1] || "");
        break;
      case "wait":
        await page.waitForTimeout(parseInt(args[0]));
        break;
      case "assert_visible":
        await page.locator(this.dict.resolveSelector(args[0])).waitFor({ state: "visible", timeout: 10000 });
        break;
      case "assert_url": {
        let expected: string;
        try { expected = this.dict.resolveUrl(args[0]); } catch { expected = args[0]; }
        if (!page.url().includes(expected))
          throw new Error(`URL 불일치\n  기대: '${expected}'\n  실제: '${page.url()}'`);
        break;
      }
      case "assert_text": {
        const actual = await page.locator(this.dict.resolveSelector(args[0])).innerText();
        if (!actual.includes(args[1] || ""))
          throw new Error(`텍스트 불일치\n  기대: '${args[1]}'\n  실제: '${actual}'`);
        break;
      }
      default:
        throw new Error(`[DSL] 알 수 없는 명령: '${cmd}'`);
    }
  }
}
