import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuthStatus } from "@/lib/admin/server-auth";
import { fetchSpotifySetlist } from "@/lib/spotify/setlist-import";

export const runtime = "nodejs";

const requestSchema = z.object({
  url: z.string().min(1),
});

export async function POST(request: Request) {
  const authStatus = await getAdminAuthStatus();
  if (!authStatus.authenticated) {
    return NextResponse.json({ error: authStatus.message }, { status: 401 });
  }

  const parsedBody = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  try {
    const result = await fetchSpotifySetlist(parsedBody.data.url);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Spotify 解析失败。" },
      { status: 400 },
    );
  }
}
