import { NextResponse } from "next/server";
import { listProviderInfo, resolveProvider } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Surfaces which providers are configured so the frontend can populate the
// dropdown and indicate which require setup. Never returns API keys.
export async function GET() {
  return NextResponse.json({
    providers: listProviderInfo(),
    default: resolveProvider(null),
  });
}
