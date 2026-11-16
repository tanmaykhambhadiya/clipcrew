import { pool } from "./pool";

// A small query builder with the same call style the app was written against
// (db.from("t").select("a, b").eq("x", 1).order("a").range(0, 9) ... awaited as { data, error, count }),
// running parameterised SQL on our own Postgres. It supports exactly the subset the code uses and
// throws on anything else, so unsupported calls fail loudly instead of silently returning wrong data.

export type DbError = { code: string; message: string; details: string | null; hint: string | null };
export type Result = { data: any; error: DbError | null; count: number | null };

const TABLES = new Set([
  "waitlist", "contact_messages", "profiles", "credentials", "sessions", "campaigns", "campaign_staff",
  "campaign_clippers", "social_accounts", "campaign_accounts", "weekly_views", "fines", "notifications",
  "payouts", "audit_log", "clipper_balances", "submissions",
]);
const PRIMARY_KEY: Record<string, string[]> = {
  credentials: ["user_id"],
  sessions: ["token_hash"],
  campaign_staff: ["campaign_id", "staff_id"],
  campaign_clippers: ["campaign_id", "clipper_id"],
  campaign_accounts: ["campaign_id", "account_id"],
};
// Columns stored as jsonb: always sent as JSON text (a JS array would otherwise become a Postgres array).
const JSONB_COLUMNS: Record<string, string[]> = { audit_log: ["before", "after"] };

const IDENT = /^[a-z_][a-z0-9_]*$/i;
const ident = (s: string) => {
  if (!IDENT.test(s)) throw new Error(`Invalid column or table name: ${JSON.stringify(s)}`);
  return `"${s}"`;
};

class Params {
  values: unknown[] = [];
  add(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}
type Cond = (p: Params) => string;

// ───────────── or("a.eq.1,and(b.is.null,c.in.(1,2))") ─────────────
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, inQuote = false, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && inQuote) { i++; continue; }
    if (c === '"') inQuote = !inQuote;
    else if (!inQuote && c === "(") depth++;
    else if (!inQuote && c === ")") depth--;
    else if (!inQuote && depth === 0 && c === ",") { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}
const unquote = (v: string) => (v.startsWith('"') && v.endsWith('"') && v.length >= 2 ? v.slice(1, -1).replace(/\\(.)/g, "$1") : v);
const OPS: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };

function parseOr(expr: string, join: "or" | "and"): Cond {
  const items = splitTop(expr).map((item): Cond => {
    const nested = /^(and|or)\(([\s\S]*)\)$/.exec(item);
    if (nested) return parseOr(nested[2], nested[1] as "and" | "or");
    const m = /^([a-z_][a-z0-9_]*)\.([a-z]+)\.([\s\S]*)$/i.exec(item);
    if (!m) throw new Error(`Unsupported filter: ${item}`);
    const [, col, op, raw] = m;
    const c = ident(col);
    if (op === "is") {
      const v = raw.toLowerCase();
      if (v !== "null" && v !== "true" && v !== "false") throw new Error(`Unsupported is.${raw}`);
      return () => `${c} is ${v}`;
    }
    if (op === "in") {
      const inner = raw.startsWith("(") && raw.endsWith(")") ? raw.slice(1, -1) : raw;
      const list = splitTop(inner).map(unquote);
      return list.length ? (p) => `${c} = any(${p.add(list)})` : () => "false";
    }
    if (op in OPS) return (p) => `${c} ${OPS[op]} ${p.add(unquote(raw))}`;
    throw new Error(`Unsupported filter operator: ${op}`);
  });
  return (p) => `(${items.map((f) => f(p)).join(join === "or" ? " or " : " and ")})`;
}

// ───────────── Builder ─────────────
type Op = "select" | "insert" | "update" | "delete" | "upsert";

function isPgError(e: unknown): e is { code: string; message: string; detail?: string; hint?: string } {
  return !!e && typeof e === "object" && typeof (e as any).code === "string" && ("severity" in (e as any) || "routine" in (e as any));
}
const toDbError = (e: { code: string; message: string; detail?: string; hint?: string }): DbError => ({
  code: e.code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null,
});

export class Builder implements PromiseLike<Result> {
  private op: Op = "select";
  private columns = "*";
  private returning: string | null = null;
  private wantCount = false;
  private head = false;
  private conds: Cond[] = [];
  private impossible = false;
  private orders: string[] = [];
  private lim?: number;
  private off?: number;
  private mode: "many" | "single" | "maybe" = "many";
  private rows: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private conflict?: string[];
  private ignoreDuplicates = false;

  constructor(private table: string) {
    if (!TABLES.has(table)) throw new Error(`Unknown table: ${table}`);
  }

  // ── what to do ──
  select(columns = "*", opts: { count?: "exact" | "planned" | "estimated"; head?: boolean } = {}) {
    if (this.op === "select") {
      this.columns = columns;
      this.wantCount = !!opts.count;
      this.head = !!opts.head;
    } else {
      this.returning = columns; // insert(...).select() / update(...).select()
    }
    return this;
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = "insert";
    this.rows = Array.isArray(values) ? values : [values];
    return this;
  }
  upsert(values: Record<string, unknown> | Record<string, unknown>[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = "upsert";
    this.rows = Array.isArray(values) ? values : [values];
    this.conflict = (opts.onConflict ?? (PRIMARY_KEY[this.table] ?? ["id"]).join(",")).split(",").map((s) => s.trim());
    this.ignoreDuplicates = !!opts.ignoreDuplicates;
    return this;
  }
  update(values: Record<string, unknown>) {
    this.op = "update";
    this.patch = values;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }

  // ── filters ──
  private cond(f: Cond) { this.conds.push(f); return this; }
  eq(col: string, v: unknown) { const c = ident(col); return this.cond((p) => `${c} = ${p.add(v)}`); }
  neq(col: string, v: unknown) { const c = ident(col); return this.cond((p) => `${c} <> ${p.add(v)}`); }
  gt(col: string, v: unknown) { const c = ident(col); return this.cond((p) => `${c} > ${p.add(v)}`); }
  gte(col: string, v: unknown) { const c = ident(col); return this.cond((p) => `${c} >= ${p.add(v)}`); }
  lt(col: string, v: unknown) { const c = ident(col); return this.cond((p) => `${c} < ${p.add(v)}`); }
  lte(col: string, v: unknown) { const c = ident(col); return this.cond((p) => `${c} <= ${p.add(v)}`); }
  like(col: string, v: string) { const c = ident(col); return this.cond((p) => `${c} like ${p.add(v)}`); }
  ilike(col: string, v: string) { const c = ident(col); return this.cond((p) => `${c} ilike ${p.add(v)}`); }
  contains(col: string, v: unknown[]) { const c = ident(col); return this.cond((p) => `${c} @> ${p.add(v)}`); }
  in(col: string, arr: readonly unknown[]) {
    const c = ident(col);
    if (!arr.length) { this.impossible = true; return this; } // IN () matches nothing
    return this.cond((p) => `${c} = any(${p.add([...arr])})`);
  }
  is(col: string, v: null | boolean) {
    const c = ident(col);
    return this.cond(() => `${c} is ${v === null ? "null" : v ? "true" : "false"}`);
  }
  not(col: string, op: string, v: unknown) {
    const c = ident(col);
    if (op === "is") return this.cond(() => `${c} is not ${v === null ? "null" : v ? "true" : "false"}`);
    if (op === "eq") return this.cond((p) => `${c} <> ${p.add(v)}`);
    throw new Error(`Unsupported not() operator: ${op}`);
  }
  or(expr: string) {
    const f = parseOr(expr, "or");
    return this.cond((p) => f(p));
  }

  // ── shaping ──
  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    this.orders.push(`${ident(col)} ${opts.ascending === false ? "desc" : "asc"}${opts.nullsFirst === undefined ? "" : opts.nullsFirst ? " nulls first" : " nulls last"}`);
    return this;
  }
  limit(n: number) { this.lim = Math.max(0, Math.floor(n)); return this; }
  range(from: number, to: number) { this.off = Math.max(0, Math.floor(from)); this.lim = Math.max(0, Math.floor(to) - this.off + 1); return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  then<A = Result, B = never>(onfulfilled?: ((v: Result) => A | PromiseLike<A>) | null, onrejected?: ((r: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(onfulfilled, onrejected);
  }

  // ── execution ──
  private where(p: Params): string {
    return this.conds.length ? ` where ${this.conds.map((c) => c(p)).join(" and ")}` : "";
  }
  private columnList(cols: string): string {
    if (cols.trim() === "*") return "*";
    if (/[(:!]/.test(cols)) throw new Error(`Embedded/aliased select is not supported here: ${cols}`);
    return cols.split(",").map((c) => ident(c.trim())).join(", ");
  }
  private shape(rows: any[]): { data: any; error: DbError | null } {
    if (this.mode === "many") return { data: rows, error: null };
    if (this.mode === "maybe" && rows.length === 0) return { data: null, error: null };
    if (rows.length !== 1) {
      return {
        data: null,
        error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows`, hint: null },
      };
    }
    return { data: rows[0], error: null };
  }
  private bind(col: string, v: unknown): unknown {
    if (v === null || v === undefined) return null;
    if (JSONB_COLUMNS[this.table]?.includes(col)) return JSON.stringify(v);
    if (typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) return JSON.stringify(v);
    return v;
  }

  private async run(): Promise<Result> {
    try {
      switch (this.op) {
        case "select": return await this.runSelect();
        case "insert":
        case "upsert": return await this.runInsert();
        case "update": return await this.runUpdate();
        case "delete": return await this.runDelete();
      }
    } catch (e) {
      if (isPgError(e)) return { data: null, error: toDbError(e), count: null };
      throw e;
    }
  }

  private async runSelect(): Promise<Result> {
    if (this.impossible) return { ...this.shape([]), count: this.wantCount ? 0 : null, ...(this.mode === "many" ? { data: this.head ? null : [] } : {}) };
    const t = ident(this.table);
    let count: number | null = null;
    const countQuery = this.wantCount
      ? (async () => {
          const p = new Params();
          const r = await pool().query(`select count(*)::int as n from ${t}${this.where(p)}`, p.values as any[]);
          return r.rows[0].n as number;
        })()
      : Promise.resolve(null);
    if (this.head) {
      count = await countQuery;
      return { data: null, error: null, count };
    }
    const p = new Params();
    let text = `select ${this.columnList(this.columns)} from ${t}${this.where(p)}`;
    if (this.orders.length) text += ` order by ${this.orders.join(", ")}`;
    const lim = this.lim ?? (this.mode === "many" ? undefined : 2); // single(): fetch 2 to detect "more than one"
    if (lim !== undefined) text += ` limit ${lim}`;
    if (this.off) text += ` offset ${this.off}`;
    const [res, n] = await Promise.all([pool().query(text, p.values as any[]), countQuery]);
    count = n;
    return { ...this.shape(res.rows), count };
  }

  private async runInsert(): Promise<Result> {
    if (!this.rows.length) return { data: this.returning ? [] : null, error: null, count: null };
    const t = ident(this.table);
    const cols = [...new Set(this.rows.flatMap((r) => Object.keys(r).filter((k) => r[k] !== undefined)))];
    if (!cols.length) throw new Error("insert() needs at least one column value");
    const p = new Params();
    const tuples = this.rows.map((r) => `(${cols.map((c) => (r[c] === undefined ? "default" : p.add(this.bind(c, r[c])))).join(", ")})`);
    let text = `insert into ${t} (${cols.map(ident).join(", ")}) values ${tuples.join(", ")}`;
    if (this.op === "upsert") {
      const keys = this.conflict!;
      const rest = cols.filter((c) => !keys.includes(c));
      text += ` on conflict (${keys.map(ident).join(", ")}) ` + (this.ignoreDuplicates || !rest.length ? "do nothing" : `do update set ${rest.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ")}`);
    }
    return this.finishMutation(text, p);
  }

  private async runUpdate(): Promise<Result> {
    if (this.impossible) return { data: this.returning ? [] : null, error: null, count: null };
    if (!this.conds.length) throw new Error("update() without a filter is not allowed");
    const keys = Object.keys(this.patch).filter((k) => this.patch[k] !== undefined);
    if (!keys.length) throw new Error("update() needs at least one column value");
    const p = new Params();
    const set = keys.map((k) => `${ident(k)} = ${p.add(this.bind(k, this.patch[k]))}`).join(", ");
    return this.finishMutation(`update ${ident(this.table)} set ${set}${this.where(p)}`, p);
  }

  private async runDelete(): Promise<Result> {
    if (this.impossible) return { data: this.returning ? [] : null, error: null, count: null };
    if (!this.conds.length) throw new Error("delete() without a filter is not allowed");
    const p = new Params();
    return this.finishMutation(`delete from ${ident(this.table)}${this.where(p)}`, p);
  }

  private async finishMutation(text: string, p: Params): Promise<Result> {
    if (this.returning) text += ` returning ${this.columnList(this.returning)}`;
    const res = await pool().query(text, p.values as any[]);
    if (!this.returning) return { data: null, error: null, count: res.rowCount };
    return { ...this.shape(res.rows), count: res.rowCount };
  }
}

export const db = { from: (table: string) => new Builder(table) };
export type Db = typeof db;
