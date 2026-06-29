import { getAdminAuthStatus } from "@/lib/admin/server-auth";
import {
  eventVisibilityRulesToFormText,
  parseEventVisibilityRulesForm,
  readEventVisibilityRules,
  writeEventVisibilityRules,
} from "@/lib/events/event-visibility-rules-store";
import { RulesForm, type RulesActionState } from "./rules-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function submitRules(
  _: RulesActionState,
  formData: FormData,
): Promise<RulesActionState> {
  "use server";

  const authStatus = await getAdminAuthStatus();
  if (!authStatus.authenticated) {
    return {
      status: "error",
      message: authStatus.message,
    };
  }

  const rules = parseEventVisibilityRulesForm({
    hiddenTitleKeywordsText: String(formData.get("hiddenTitleKeywordsText") ?? ""),
    hiddenEventernoteEventIdsText: String(formData.get("hiddenEventernoteEventIdsText") ?? ""),
  });

  try {
    await writeEventVisibilityRules(rules);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "保存规则失败。",
    };
  }

  return {
    status: "success",
    message: `已保存 ${rules.hiddenTitleKeywords.length} 个屏蔽词和 ${rules.hiddenEventernoteEventIds.length} 个 event ID。`,
  };
}

export default async function RulesPage() {
  const rules = await readEventVisibilityRules();
  const formText = eventVisibilityRulesToFormText(rules);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <section className="mb-6 space-y-2">
        <p className="text-sm text-ink-soft">Admin</p>
        <h1 className="text-3xl font-semibold text-foreground">活动屏蔽规则</h1>
      </section>
      <RulesForm action={submitRules} {...formText} />
    </main>
  );
}
