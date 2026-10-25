import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { createClient } from "@/lib/supabase/server";
import { getThread, markThreadRead } from "@/lib/support";
import { SupportThread } from "@/components/SupportThread";
import { replySupportMessage } from "@/app/help/actions";

// Vlákno jednoho uživatele z pohledu admina, s odpovědí.
export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const admin = await requireAdmin();
  const { t } = await resolveActiveCountry(admin);
  const { userId } = await params;

  const supabase = await createClient();
  const { data: uzivatel } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  await markThreadRead(userId, "admin");
  const messages = await getThread(userId);

  return (
    <div>
      <Link
        href="/admin/messages"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-coral"
      >
        <ArrowLeft size={16} />
        {t.backToMessages}
      </Link>
      <h1 className="mb-6 break-all font-heading text-2xl font-bold text-ink">
        {uzivatel?.email ?? "?"}
      </h1>
      <SupportThread
        messages={messages}
        threadUserId={userId}
        viewerId={admin.id}
        otherLabel={uzivatel?.email ?? "?"}
        action={replySupportMessage}
        t={t}
      />
    </div>
  );
}
