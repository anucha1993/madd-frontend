// Safe arithmetic expression evaluator for receipt line formulas — deliberately NOT using eval()/
// Function() (never evaluate arbitrary strings as code, see OWASP injection guidance). Supports:
//   - numbers (123, 123.45)
//   - {LINE NAME} references to an EARLIER line's computed amount (case-insensitive, matched by
//     that other line's current description text)
//   - + - * / ( ) and a trailing "%" postfix operator (e.g. "12%" => 0.12)
// Grammar: expression := term (('+'|'-') term)* ; term := percent (('*'|'/') percent)* ;
//          percent := unary ('%')? ; unary := ('-')? primary ; primary := NUMBER | '{' NAME '}' | '(' expression ')'

export type FormulaResult = { value: number; error: string | null };

type Token = { type: "number" | "ref" | "op" | "lparen" | "rparen" | "percent"; value: string };

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "{") {
      const end = formula.indexOf("}", i);
      if (end === -1) throw new Error("วงเล็บ { } ไม่ปิด");
      tokens.push({ type: "ref", value: formula.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < formula.length && /[0-9.]/.test(formula[j])) j++;
      tokens.push({ type: "number", value: formula.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "%") {
      tokens.push({ type: "percent", value: "%" });
      i++;
      continue;
    }
    if ("+-*/".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", value: "(" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ")" });
      i++;
      continue;
    }
    throw new Error(`อักขระที่ไม่รู้จัก: "${ch}"`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(
    private tokens: Token[],
    private values: Record<string, number>,
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error("สูตรไม่สมบูรณ์");
    this.pos++;
    return t;
  }

  parse(): number {
    const value = this.expression();
    if (this.pos < this.tokens.length) throw new Error("มีอักขระเกินหลังสูตร");
    return value;
  }

  private expression(): number {
    let value = this.term();
    while (this.peek()?.type === "op" && (this.peek()!.value === "+" || this.peek()!.value === "-")) {
      const op = this.next().value;
      const rhs = this.term();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  private term(): number {
    let value = this.percent();
    while (this.peek()?.type === "op" && (this.peek()!.value === "*" || this.peek()!.value === "/")) {
      const op = this.next().value;
      const rhs = this.percent();
      if (op === "/" && rhs === 0) throw new Error("หารด้วยศูนย์");
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  private percent(): number {
    let value = this.unary();
    if (this.peek()?.type === "percent") {
      this.next();
      value = value / 100;
    }
    return value;
  }

  private unary(): number {
    if (this.peek()?.type === "op" && this.peek()!.value === "-") {
      this.next();
      return -this.unary();
    }
    return this.primary();
  }

  private primary(): number {
    const t = this.next();
    if (t.type === "number") return parseFloat(t.value);
    if (t.type === "ref") {
      const key = t.value.trim().toUpperCase();
      if (!(key in this.values)) throw new Error(`ไม่พบบรรทัด "${t.value}" (ต้องอยู่ก่อนบรรทัดนี้)`);
      return this.values[key];
    }
    if (t.type === "lparen") {
      const value = this.expression();
      const close = this.next();
      if (close.type !== "rparen") throw new Error("วงเล็บ ( ) ไม่ปิด");
      return value;
    }
    throw new Error("สูตรไม่ถูกต้อง");
  }
}

/**
 * Evaluates a single formula string against a map of {NORMALIZED_NAME: value} for lines that
 * come BEFORE it (build this map incrementally top-to-bottom as you walk the line list).
 */
export function evaluateFormula(formula: string, values: Record<string, number>): FormulaResult {
  try {
    const tokens = tokenize(formula);
    const value = new Parser(tokens, values).parse();
    if (!Number.isFinite(value)) throw new Error("ผลลัพธ์ไม่ใช่ตัวเลข");

    return { value: Math.round(value * 100) / 100, error: null };
  } catch (err) {
    return { value: 0, error: err instanceof Error ? err.message : "สูตรไม่ถูกต้อง" };
  }
}

export function normalizeLineName(description: string): string {
  return description.trim().toUpperCase();
}
