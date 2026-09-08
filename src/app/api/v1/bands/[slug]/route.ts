import { getPublicApiCatalog } from "@/lib/public-api/data";
import {
  publicApiInvalidParameterResponse,
  publicApiJsonResponse,
  publicApiOptionsResponse,
  publicApiProblemResponse,
} from "@/lib/public-api/http";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ slug: string }>;
};

async function handle(request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const catalog = await getPublicApiCatalog();
    const band = catalog.bands.find((item) => item.slug === slug);
    if (!band) {
      return publicApiProblemResponse(request, {
        status: 404,
        code: "band_not_found",
        title: "Band not found",
        detail: `No band exists with slug "${slug}".`,
      });
    }
    return publicApiJsonResponse(request, { data: band });
  } catch (error) {
    return publicApiInvalidParameterResponse(request, error);
  }
}

export { handle as GET, handle as HEAD };
export const OPTIONS = publicApiOptionsResponse;
