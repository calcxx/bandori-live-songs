import { asc, eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  validateBandSearchAliases,
  type BandSearchAliasRow,
} from "@/lib/admin/band-search-aliases";
import { getAdminAuthStatus } from "@/lib/admin/server-auth";
import { getDb } from "@/lib/db/core";
import { bands } from "@/lib/db/schema";
import {
  BandSearchAliasesForm,
  type BandSearchAliasesActionState,
} from "./band-search-aliases-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readEditableBands(): Promise<BandSearchAliasRow[]> {
  return getDb()
    .select({
      slug: bands.slug,
      nameJa: bands.nameJa,
      nameEn: bands.nameEn,
      searchAliases: bands.searchAliases,
    })
    .from(bands)
    .where(eq(bands.groupType, "band"))
    .orderBy(asc(bands.displayOrder));
}

async function submitBandSearchAliases(
  _: BandSearchAliasesActionState,
  formData: FormData,
): Promise<BandSearchAliasesActionState> {
  "use server";

  const authStatus = await getAdminAuthStatus();
  if (!authStatus.authenticated) {
    return {
      status: "error",
      message: authStatus.message,
    };
  }

  const editableBands = await readEditableBands();
  const rawAliasesBySlug = new Map(
    editableBands.map((band) => [
      band.slug,
      String(formData.get(`aliases:${band.slug}`) ?? ""),
    ]),
  );

  let validated: ReturnType<typeof validateBandSearchAliases>;
  try {
    validated = validateBandSearchAliases(
      editableBands,
      rawAliasesBySlug,
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "检索词格式不正确。",
    };
  }

  try {
    await getDb().transaction(async (tx) => {
      for (const band of editableBands) {
        await tx
          .update(bands)
          .set({
            searchAliases:
              validated.aliasesBySlug.get(band.slug) ?? [],
            updatedAt: new Date(),
          })
          .where(eq(bands.slug, band.slug));
      }
    });
  } catch (error) {
    console.error("Failed to update band search aliases", error);
    return {
      status: "error",
      message: "保存检索词失败，请稍后重试。",
    };
  }

  updateTag("live-setlist-search");
  revalidatePath("/admin/band-search-aliases");

  return {
    status: "success",
    message: `已保存 ${validated.totalAliasCount} 个等效关键词。`,
  };
}

export default async function BandSearchAliasesPage() {
  const authStatus = await getAdminAuthStatus();
  if (!authStatus.authenticated) {
    redirect("/admin?next=%2Fadmin%2Fband-search-aliases");
  }

  const editableBands = await readEditableBands();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <section className="mb-6 space-y-2">
        <p className="text-sm text-ink-soft">Admin</p>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em] text-foreground">
          乐队等效关键词
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-ink-soft">
          为出演乐队设置等效关键词，每行一个。乐队的正式名称始终可以检索，无需重复填写；同一关键词不能分配给多个乐队。
        </p>
      </section>
      <BandSearchAliasesForm
        action={submitBandSearchAliases}
        bands={editableBands}
      />
    </main>
  );
}
