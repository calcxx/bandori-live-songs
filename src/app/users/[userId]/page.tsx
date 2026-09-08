import { PublicHomePage } from "@/components/public-home-page";

export const runtime = "nodejs";
export const maxDuration = 180;

type UserPageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{
    refresh?: string;
    awaitFreshAfter?: string;
  }>;
};

export default async function UserPage({
  params,
  searchParams,
}: UserPageProps) {
  const [{ userId }, { refresh = "", awaitFreshAfter = "" }] =
    await Promise.all([params, searchParams]);

  return (
    <PublicHomePage
      userId={userId}
      preferredSearchMode="user"
      refresh={refresh}
      awaitFreshAfter={awaitFreshAfter}
    />
  );
}
