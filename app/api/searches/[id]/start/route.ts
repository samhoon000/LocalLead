import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { store } from "@/lib/store";
import { startDiscovery } from "@/services/discovery";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { const userId = await getUserId(request); if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await context.params; const search = await store.getSearch(id, userId); if (!search) return NextResponse.json({ error: "Search not found" }, { status: 404 }); startDiscovery(search); return NextResponse.json({ jobId: search.jobId }, { status: 202 }); }
