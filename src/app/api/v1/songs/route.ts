import { getPublicApiCatalog } from "@/lib/public-api/data";
import {
  buildNextLink,
  parseBoundedQuery,
  publicApiInvalidParameterResponse,
  publicApiJsonResponse,
  publicApiOptionsResponse,
} from "@/lib/public-api/http";
import {
  paginateById,
  parseLimit,
  PublicApiParameterError,
} from "@/lib/public-api/pagination";
import type { PublicApiSong } from "@/lib/public-api/schemas";

export const runtime = "nodejs";

type SongSort = "id" | "releaseDate" | "title";
type SortOrder = "asc" | "desc";

function compareNullableText(
  left: string | null,
  right: string | null,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

function compareSongs(
  left: PublicApiSong,
  right: PublicApiSong,
  sort: SongSort,
  order: SortOrder,
) {
  const delta =
    sort === "id"
      ? left.id - right.id
      : sort === "releaseDate"
        ? compareNullableText(
            left.firstReleaseDate,
            right.firstReleaseDate,
          )
        : left.title.localeCompare(right.title);
  const ordered = order === "asc" ? delta : -delta;
  return ordered || left.id - right.id;
}

async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const query = parseBoundedQuery(url.searchParams.get("q"), "q");
    const category = url.searchParams.get("category") ?? "";
    const band = url.searchParams.get("band") ?? "";
    const sortValue = url.searchParams.get("sort") ?? "id";
    const orderValue = url.searchParams.get("order") ?? "asc";

    if (
      category &&
      !["original", "cover", "project-common"].includes(category)
    ) {
      throw new PublicApiParameterError(
        "invalid_category",
        "category must be original, cover, or project-common.",
      );
    }
    if (!["id", "releaseDate", "title"].includes(sortValue)) {
      throw new PublicApiParameterError(
        "invalid_sort",
        "sort must be id, releaseDate, or title.",
      );
    }
    if (!["asc", "desc"].includes(orderValue)) {
      throw new PublicApiParameterError(
        "invalid_order",
        "order must be asc or desc.",
      );
    }

    const catalog = await getPublicApiCatalog();
    if (band && !catalog.bands.some((item) => item.slug === band)) {
      throw new PublicApiParameterError(
        "invalid_band",
        `No band exists with slug "${band}".`,
      );
    }

    const normalizedQuery = query.toLocaleLowerCase();
    const filtered = catalog.songs
      .filter(
        (song) =>
          (!category || song.category === category) &&
          (!band || song.bandSlug === band) &&
          (!normalizedQuery ||
            song.title.toLocaleLowerCase().includes(normalizedQuery)),
      )
      .sort((left, right) =>
        compareSongs(
          left,
          right,
          sortValue as SongSort,
          orderValue as SortOrder,
        ),
      );
    const fingerprint = JSON.stringify({
      q: normalizedQuery,
      category,
      band,
      sort: sortValue,
      order: orderValue,
    });
    const page = paginateById({
      items: filtered,
      limit,
      rawCursor: url.searchParams.get("cursor"),
      resource: "songs",
      fingerprint,
      getId: (song) => song.id,
    });
    const nextLink = buildNextLink(request, page.nextCursor);

    return publicApiJsonResponse(
      request,
      {
        data: page.data,
        pagination: {
          limit,
          nextCursor: page.nextCursor,
        },
      },
      {
        headers: nextLink ? { Link: nextLink } : undefined,
      },
    );
  } catch (error) {
    return publicApiInvalidParameterResponse(request, error);
  }
}

export { handle as GET, handle as HEAD };
export const OPTIONS = publicApiOptionsResponse;

