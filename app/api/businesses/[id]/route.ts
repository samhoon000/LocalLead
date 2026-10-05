import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { store } from "@/lib/store";
import { businessPatchSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) { const userId = await getUserId(request); if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const searchId = request.nextUrl.searchParams.get("searchId"); if (!searchId || !await store.getSearch(searchId, userId)) return NextResponse.json({ error: "Search not found" }, { status: 404 }); const parsed = businessPatchSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 }); const { id } = await context.params; const business = await store.updateBusiness(searchId, id, parsed.data); return business ? NextResponse.json({ business }) : NextResponse.json({ error: "Business not found" }, { status: 404 }); }
