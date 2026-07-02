import { NextResponse } from "next/server";

import { loadConfig, saveConfig } from "@/lib/config";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";

export async function GET() {
  try {
    const config = await loadConfig(getDb());
    return NextResponse.json({ config });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const patch = await readJsonBody(req);
    const config = await saveConfig(getDb(), patch);
    return NextResponse.json({ config });
  } catch (error) {
    return handleRouteError(error);
  }
}
