import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { store } from "@/lib/store";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) { const userId = await getUserId(request); if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await context.params; const search = await store.getSearch(id, userId); if (!search) return NextResponse.json({ error: "Search not found" }, { status: 404 }); const job = await store.getJob(search.jobId, userId); return NextResponse.json({ search, job }); }
