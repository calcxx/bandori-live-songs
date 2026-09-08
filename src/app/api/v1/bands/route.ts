import { getPublicApiCatalog } from "@/lib/public-api/data";
import {
  publicApiInvalidParameterResponse,
  publicApiJsonResponse,
  publicApiOptionsResponse,
} from "@/lib/public-api/http";

export const runtime = "nodejs";

async function handle(request: Request) {
  try {
    const catalog = await getPublicApiCatalog();
    return publicApiJsonResponse(request, { data: catalog.bands });
  } catch (error) {
    return publicApiInvalidParameterResponse(request, error);
  }
}

export { handle as GET, handle as HEAD };
export const OPTIONS = publicApiOptionsResponse;
