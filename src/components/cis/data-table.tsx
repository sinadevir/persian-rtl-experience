import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, MoreHorizontal, Search, ChevronRight, ChevronLeft, Inbox, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ErrorState } from "./query-state";
import { faNum } from "@/lib/jalali";
import { downloadCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

export type Column<T> = { key: string; header: string; cell?: (r: T) => ReactNode; value?: (r: T) => string | number | undefined; className?: string; hidden?: boolean; sortable?: boolean };
export type RowAction<T> = { label: string; icon?: LucideIcon; onClick: (r: T) => void; destructive?: boolean; show?: (r: T) => boolean };
export type FilterOption = string | { value: string; label: string };
export type Filter = { key: string; label: string; options: FilterOption[] };

type Props<T> = {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string | number;
  searchPlaceholder?: string; filters?: Filter[]; actions?: RowAction<T>[]; onRowClick?: (r: T) => void;
  toolbar?: ReactNode; pageSize?: number; selectable?: boolean; bulkActions?: (sel: T[], clear: () => void) => ReactNode; dense?: boolean;
  loading?: boolean; fetching?: boolean; error?: unknown; onRetry?: () => void; emptyText?: string; emptyAction?: ReactNode; exportName?: string; hideSearch?: boolean;
  /** Server mode: when given, search/filter/paging are sent to the backend instead of applied locally. */
  server?: { total: number; page: number; pageSize: number; onPageChange: (p: number) => void; search?: string; onSearchChange?: (q: string) => void; filterValues?: Record<string, string>; onFilterChange?: (key: string, value: string) => void };
};

const get = <T,>(c: Column<T>, r: T) => (c.value ? c.value(r) : (r as Record<string, unknown>)[c.key]) as string | number | undefined;
const fv = (o: FilterOption) => (typeof o === "string" ? o : o.value);
const fl = (o: FilterOption) => (typeof o === "string" ? o : o.label);

export function DataTable<T>({ rows, columns, rowKey, searchPlaceholder = "جستجو…", filters = [], actions, onRowClick, toolbar, pageSize = 10, selectable, bulkActions, dense, loading, fetching, error, onRetry, emptyText = "موردی یافت نشد", emptyAction, exportName = "export", hideSearch, server }: Props<T>) {
  const [q, setQ] = useState(server?.search ?? "");
  const [localFilters, setLocalFilters] = useState<Record<string, string>>({});
  const filterValues = server?.filterValues ?? localFilters;
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set(columns.filter((c) => c.hidden).map((c) => c.key)));
  const [localPage, setLocalPage] = useState(0);
  const [sel, setSel] = useState<Set<string | number>>(new Set());

  // debounce server search
  useEffect(() => {
    if (!server?.onSearchChange || q === (server.search ?? "")) return;
    const t = setTimeout(() => server.onSearchChange?.(q), 400);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => {
    let d = rows;
    if (!server) {
      d = d.filter((r) => {
        if (q && !columns.some((c) => String(get(c, r) ?? "").includes(q))) return false;
        return filters.every((f) => !filterValues[f.key] || filterValues[f.key] === "all" || String((r as Record<string, unknown>)[f.key]) === filterValues[f.key]);
      });
    }
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c) d = [...d].sort((a, b) => String(get(c, a) ?? "").localeCompare(String(get(c, b) ?? ""), "fa", { numeric: true }) * sort.dir);
    }
    return d;
  }, [rows, q, filterValues, sort, columns, filters, server]);

  const page = server ? server.page - 1 : localPage;
  const size = server ? server.pageSize : pageSize;
  const total = server ? server.total : data.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const view = server ? data : data.slice(page * size, page * size + size);
  const visible = columns.filter((c) => !hidden.has(c.key));
  const selectedRows = rows.filter((r) => sel.has(rowKey(r)));
  const setPage = (p: number) => (server ? server.onPageChange(p + 1) : setLocalPage(p));
  const setFilter = (k: string, v: string) => { if (server?.onFilterChange) server.onFilterChange(k, v === "all" ? "" : v); else { setLocalFilters({ ...localFilters, [k]: v }); setLocalPage(0); } };
  const colSpan = visible.length + (selectable ? 1 : 0) + (actions ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        {!hideSearch && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); if (!server) setLocalPage(0); }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="h-9 pr-9 pl-8" />
            {q && <button type="button" onClick={() => { setQ(""); server?.onSearchChange?.(""); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="پاک کردن جستجو"><X className="size-4" /></button>}
          </div>
        )}
        {filters.map((f) => (
          <Select key={f.key} value={filterValues[f.key] || "all"} onValueChange={(v) => setFilter(f.key, v)}>
            <SelectTrigger className="h-9 w-auto min-w-32" aria-label={f.label}><SelectValue placeholder={f.label} /></SelectTrigger>
            <SelectContent><SelectItem value="all">همه {f.label}</SelectItem>{f.options.map((o) => <SelectItem key={fv(o)} value={fv(o)}>{fl(o)}</SelectItem>)}</SelectContent>
          </Select>
        ))}
        <div className="mr-auto flex flex-wrap gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-9" aria-label="انتخاب ستون‌ها"><Columns3 /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuLabel>ستون‌های قابل نمایش</DropdownMenuLabel><DropdownMenuSeparator />
              {columns.map((c) => <DropdownMenuCheckboxItem key={c.key} checked={!hidden.has(c.key)} onCheckedChange={(v) => { const n = new Set(hidden); if (v) n.delete(c.key); else n.add(c.key); setHidden(n); }}>{c.header}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" className="size-9" aria-label="خروجی Excel از ردیف‌های نمایش داده‌شده" title="خروجی Excel (ردیف‌های همین صفحه)" disabled={view.length === 0}
            onClick={() => downloadCsv(exportName, visible.map((c) => c.header), view.map((r) => visible.map((c) => get(c, r))))}><Download /></Button>
        </div>
      </div>
      {selectable && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b bg-accent/50 px-3 py-2 text-sm">
          {faNum(selectedRows.length)} ردیف انتخاب شده {bulkActions?.(selectedRows, () => setSel(new Set()))}
          <Button size="sm" variant="ghost" className="mr-auto h-7" onClick={() => setSel(new Set())}>لغو انتخاب</Button>
        </div>
      )}
      <div className={cn("relative overflow-x-auto", fetching && !loading && "opacity-70 transition-opacity")}>
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            {selectable && <TableHead className="w-12 border-l px-4 text-center"><Checkbox className="mx-auto" aria-label="انتخاب همه" checked={view.length > 0 && view.every((r) => sel.has(rowKey(r)))} onCheckedChange={(v) => { const n = new Set(sel); view.forEach((r) => (v ? n.add(rowKey(r)) : n.delete(rowKey(r)))); setSel(n); }} /></TableHead>}
            {visible.map((c) => {
              const active = sort?.key === c.key;
              return (
                <TableHead key={c.key} className={cn("whitespace-nowrap text-right", c.className)} aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined}>
                  {c.sortable === false ? c.header : (
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}>
                      {c.header}{active ? (sort!.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
                    </button>
                  )}
                </TableHead>
              );
            })}
            {actions && <TableHead className="w-10"><span className="sr-only">عملیات</span></TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }, (_, i) => <TableRow key={`sk${i}`}>{Array.from({ length: colSpan }, (_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>)}
            {!loading && Boolean(error) && <TableRow><TableCell colSpan={colSpan} className="p-4"><ErrorState error={error} onRetry={onRetry} compact className="border-0" /></TableCell></TableRow>}
            {!loading && !error && view.length === 0 && (
              <TableRow><TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground"><Inbox className="mx-auto mb-2 size-8 opacity-40" aria-hidden />{emptyText}{emptyAction && <div className="mt-3">{emptyAction}</div>}</TableCell></TableRow>
            )}
            {!loading && !error && view.map((r) => (
              <TableRow key={rowKey(r)} className={cn(onRowClick && "cursor-pointer focus-visible:bg-muted focus-visible:outline-none")} tabIndex={onRowClick ? 0 : undefined}
                onClick={() => onRowClick?.(r)} onKeyDown={(e) => { if (onRowClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onRowClick(r); } }}>
                {selectable && <TableCell className="w-12 border-l px-4 text-center" onClick={(e) => e.stopPropagation()}><Checkbox className="mx-auto" aria-label="انتخاب ردیف" checked={sel.has(rowKey(r))} onCheckedChange={(v) => { const n = new Set(sel); if (v) n.add(rowKey(r)); else n.delete(rowKey(r)); setSel(n); }} /></TableCell>}
                {visible.map((c) => <TableCell key={c.key} className={cn("whitespace-nowrap", dense && "py-1.5", c.className)}>{c.cell ? c.cell(r) : (() => { const v: unknown = get(c, r); return v === true || v === "true" ? "بله" : v === false || v === "false" ? "خیر" : String(v ?? "—") || "—"; })()}</TableCell>)}
                {actions && (
                  <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {actions.some((a) => !a.show || a.show(r)) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label="عملیات ردیف"><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {actions.filter((a) => !a.show || a.show(r)).map((a) => (
                            <DropdownMenuItem key={a.label} onClick={() => a.onClick(r)} className={cn(a.destructive && "text-destructive focus:text-destructive")}>{a.icon && <a.icon />}{a.label}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-sm text-muted-foreground">
        <span>{loading ? "در حال بارگذاری…" : `${faNum(total)} رکورد`}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" disabled={page === 0 || loading} onClick={() => setPage(page - 1)} aria-label="صفحه قبل"><ChevronRight /></Button>
          <span>صفحه {faNum(page + 1)} از {faNum(pages)}</span>
          <Button variant="outline" size="icon" className="size-8" disabled={page >= pages - 1 || loading} onClick={() => setPage(page + 1)} aria-label="صفحه بعد"><ChevronLeft /></Button>
        </div>
      </div>
    </div>
  );
}

/** Wires a paged query result into DataTable props. */
export function tableState<T>(q: { data?: { items: T[]; total: number; page: number; pageSize: number }; isPending: boolean; isFetching: boolean; error: unknown; refetch: () => unknown }) {
  return { rows: q.data?.items ?? [], loading: q.isPending, fetching: q.isFetching, error: q.error ?? undefined, onRetry: () => void q.refetch() };
}
