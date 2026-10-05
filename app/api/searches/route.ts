import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { store } from "@/lib/store";
import { searchInputSchema } from "@/lib/validation";

export async function GET(request: NextRequest) { const userId = await getUserId(request); if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); return NextResponse.json({ searches: await store.listSearches(userId), storageMode: store.mode() }); }
export async function POST(request: NextRequest) {
  const userId = await getUserId(request); if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = searchInputSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid search", details: parsed.error.flatten() }, { status: 400 });
  try { return NextResponse.json({ search: await store.createSearch(userId, parsed.data) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create search" }, { status: 500 }); }
}
