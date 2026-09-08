import { getPublicApiCatalog } from "@/lib/public-api/data";
import {
  parsePositiveInteger,
  publicApiInvalidParameterResponse,
  publicApiJsonResponse,
  publicApiOptionsResponse,
  publicApiProblemResponse,
} from "@/lib/public-api/http";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

async function handle(request: Request, context: Context) {
  try {
    const { id: rawId } = await context.params;
    const id = parsePositiveInteger(rawId, "song_id");
    const catalog = await getPublicApiCatalog();
    const song = catalog.songs.find((item) => item.id === id);
    if (!song) {
      return publicApiProblemResponse(request, {
        status: 404,
        code: "song_not_found",
        title: "Song not found",
        detail: `No song exists with id ${id}.`,
      });
    }
    return publicApiJsonResponse(request, { data: song });
  } catch (error) {
    return publicApiInvalidParameterResponse(request, error);
  }
}

export { handle as GET, handle as HEAD };
export const OPTIONS = publicApiOptionsResponse;

