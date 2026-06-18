import { chromium } from "playwright";

export interface PageElement {
  tag: string;
  type?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  text?: string;
  role?: string;
  selector: string;
}

export async function extractPageElements(url: string): Promise<PageElement[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);

    const elements = await page.evaluate(() => {
      const results: any[] = [];
      const seen = new Set<string>();

      const candidates = document.querySelectorAll(
        'input, button, select, textarea, a[href], [role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="combobox"], [role="listbox"]'
      );

      candidates.forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const type = (el as HTMLInputElement).type || undefined;
        const id = el.id || undefined;
        const name = (el as HTMLInputElement).name || undefined;
        const placeholder = (el as HTMLInputElement).placeholder || undefined;
        const ariaLabel = el.getAttribute("aria-label") || undefined;
        const role = el.getAttribute("role") || undefined;
        const text = el.textContent?.trim().slice(0, 40) || undefined;

        // 고유 셀렉터 생성
        let selector = tag;
        if (id) selector = `#${id}`;
        else if (name) selector = `${tag}[name="${name}"]`;
        else if (ariaLabel) selector = `${tag}[aria-label="${ariaLabel}"]`;
        else if (placeholder) selector = `${tag}[placeholder="${placeholder}"]`;
        else if (type && tag === "input") selector = `input[type="${type}"]`;

        // 숨김 요소 제외
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return;

        // 중복 제외
        if (seen.has(selector)) return;
        seen.add(selector);

        results.push({ tag, type, id, name, placeholder, ariaLabel, text, role, selector });
      });

      return results.slice(0, 60); // 최대 60개
    });

    return elements;
  } finally {
    await browser.close();
  }
}

export function formatElementsForPrompt(elements: PageElement[]): string {
  if (!elements.length) return "(요소를 추출하지 못했습니다)";

  return elements.map((el) => {
    const parts = [el.selector];
    if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
    if (el.ariaLabel) parts.push(`aria-label="${el.ariaLabel}"`);
    if (el.text) parts.push(`text="${el.text}"`);
    if (el.role) parts.push(`role="${el.role}"`);
    return `  - ${parts.join(" | ")}`;
  }).join("\n");
}
