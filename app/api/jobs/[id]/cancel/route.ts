import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { store } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { const userId = await getUserId(request); if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await context.params; return NextResponse.json({ cancelled: await store.cancelJob(id, userId) }); }
