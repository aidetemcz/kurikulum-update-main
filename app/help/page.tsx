import { requireUser } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { getThread, markThreadRead } from "@/lib/support";
import { SupportThread } from "@/components/SupportThread";
import { sendSupportMessage } from "@/app/help/actions";

// „Napsat adminovi“ – vlákno přihlášeného uživatele s adminy.
export default async function HelpPage() {
  const user = await requireUser();
  const { t } = await resolveActiveCountry(user);

  await markThreadRead(user.id, "user");
  const messages = await getThread(user.id);

  return (
    <div>
      <h1 className="mb-2 font-heading text-3xl font-bold text-ink">{t.helpTitle}</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">{t.helpIntro}</p>
      <SupportThread
        messages={messages}
        threadUserId={user.id}
        viewerId={user.id}
        otherLabel={t.adminLabel}
        action={sendSupportMessage}
        t={t}
      />
    </div>
  );
}
