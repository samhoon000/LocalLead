import { after, NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { store } from "@/lib/store";
import { runDiscovery } from "@/services/discovery";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request); if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params; const search = await store.getSearch(id, userId); if (!search) return NextResponse.json({ error: "Search not found" }, { status: 404 });
  if (!await store.claimJob(search.jobId, userId)) return NextResponse.json({ error: "Discovery has already started" }, { status: 409 });
  after(() => runDiscovery(search));
  return NextResponse.json({ jobId: search.jobId }, { status: 202 });
}
