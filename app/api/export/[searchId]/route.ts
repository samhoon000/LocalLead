import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getUserId } from "@/lib/auth";
import { store } from "@/lib/store";

const headers = ["Business name", "Category", "Rating", "Reviews", "Address", "City", "State", "Country", "Phone", "Email", "Website", "Website status", "Website quality score", "Opportunity score", "Lead status", "Maps URL", "Notes"];
function rows(search: NonNullable<Awaited<ReturnType<typeof store.getSearch>>>, ids?: Set<string>) { return search.businesses.filter((b) => !ids || ids.has(b.id)).map((b) => [b.name, b.category, b.rating ?? "", b.reviewCount ?? "", b.address, b.city, b.state ?? "", b.country, b.phone ?? "", b.email ?? "", b.websiteUrl ?? "", b.websiteStatus, b.analysis?.qualityScore ?? "", b.leadScore.score, b.leadStatus, b.mapsUrl ?? "", b.notes]); }
function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
export async function GET(request: NextRequest, context: { params: Promise<{ searchId: string }> }) {
  const userId = await getUserId(request); if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { searchId } = await context.params; const search = await store.getSearch(searchId, userId); if (!search) return NextResponse.json({ error: "Search not found" }, { status: 404 });
  const idsParam = request.nextUrl.searchParams.get("ids"); const ids = idsParam ? new Set(idsParam.split(",")) : undefined; const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv"; const data = rows(search, ids);
  if (format === "xlsx") { const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...data]), "Leads"); const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }); return new NextResponse(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${search.name.replace(/[^a-z0-9]+/gi, "-")}.xlsx"` } }); }
  const body = "\ufeff" + [headers, ...data].map((row) => row.map(csvCell).join(",")).join("\r\n"); return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${search.name.replace(/[^a-z0-9]+/gi, "-")}.csv"` } });
}
