"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { adminEmails } from "@/lib/support";
import { sendSupportEmail } from "@/lib/mail";

export type MessageState = { error: string } | { sentAt: string; count?: number } | null;

const MAX_DELKA = 4000;

// Uživatel píše adminům do svého vlákna.
export async function sendSupportMessage(
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  const user = await requireUser();
  const { t } = await resolveActiveCountry(user);

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: t.messageEmpty };
  if (body.length > MAX_DELKA) return { error: t.messageTooLong };

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_messages")
    .insert({ user_id: user.id, author_id: user.id, body });
  if (error) {
    console.error("Zprávu adminovi se nepodařilo uložit:", error);
    return { error: t.messageFailed };
  }

  // E-mail adminům je jen upozornění navíc; když neodejde, zpráva v appce
  // zůstává a admini ji uvidí v menu.
  for (const email of await adminEmails()) {
    if (email === user.email) continue;
    const odeslano = await sendSupportEmail({
      to: email,
      from: user.email,
      body,
      path: `/admin/messages/${user.id}`,
    });
    if (!odeslano.sent) console.warn(`Upozornění na zprávu pro ${email} neodešlo.`);
  }

  revalidatePath("/help");
  revalidatePath("/admin/messages");
  return { sentAt: new Date().toISOString() };
}

// Admin odpovídá do vlákna konkrétního uživatele.
export async function replySupportMessage(
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  const admin = await requireAdmin();
  const { t } = await resolveActiveCountry(admin);

  const userId = String(formData.get("userId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!userId) return { error: t.messageFailed };
  if (!body) return { error: t.messageEmpty };
  if (body.length > MAX_DELKA) return { error: t.messageTooLong };

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_messages")
    .insert({ user_id: userId, author_id: admin.id, body });
  if (error) {
    console.error("Odpověď se nepodařilo uložit:", error);
    return { error: t.messageFailed };
  }

  const { data: prijemce } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (prijemce?.email && prijemce.email !== admin.email) {
    const odeslano = await sendSupportEmail({
      to: prijemce.email,
      from: "admin AI kurikula",
      body,
      path: "/help",
    });
    if (!odeslano.sent) console.warn(`Upozornění na odpověď pro ${prijemce.email} neodešlo.`);
  }

  revalidatePath(`/admin/messages/${userId}`);
  revalidatePath("/admin/messages");
  return { sentAt: new Date().toISOString() };
}

// Admin píše sám od sebe: všem lidem z vybraných zemí, nebo jednomu
// člověku. Každý příjemce dostane zprávu do svého vlákna, takže odpovídá
// jako obvykle přes „Napsat adminovi“.
export async function adminSendMessage(
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  const admin = await requireAdmin();
  const { t } = await resolveActiveCountry(admin);

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: t.messageEmpty };
  if (body.length > MAX_DELKA) return { error: t.messageTooLong };

  const supabase = await createClient();
  let userIds: string[];
  if (formData.get("to") === "person") {
    const userId = String(formData.get("userId") ?? "");
    if (!userId) return { error: t.composePickPerson };
    userIds = [userId];
  } else {
    const countryIds = formData.getAll("countryId").map(String).filter(Boolean);
    if (countryIds.length === 0) return { error: t.composePickCountry };
    const { data, error } = await supabase
      .from("user_countries")
      .select("user_id")
      .in("country_id", countryIds);
    if (error) {
      console.error("Lidi z vybraných zemí se nepodařilo načíst:", error);
      return { error: t.messageFailed };
    }
    userIds = [...new Set((data ?? []).map((row) => row.user_id as string))];
  }

  // Sám sobě admin nepíše.
  userIds = userIds.filter((id) => id !== admin.id);
  if (userIds.length === 0) return { error: t.composeNoRecipients };

  const { error } = await supabase
    .from("support_messages")
    .insert(userIds.map((userId) => ({ user_id: userId, author_id: admin.id, body })));
  if (error) {
    console.error("Zprávu od admina se nepodařilo uložit:", error);
    return { error: t.messageFailed };
  }

  const { data: prijemci } = await supabase.from("users").select("email").in("id", userIds);
  for (const { email } of prijemci ?? []) {
    if (!email) continue;
    const odeslano = await sendSupportEmail({
      to: email,
      from: "admin AI kurikula",
      body,
      path: "/help",
    });
    if (!odeslano.sent) console.warn(`Upozornění na zprávu pro ${email} neodešlo.`);
  }

  revalidatePath("/admin/messages");
  revalidatePath("/help");
  return { sentAt: new Date().toISOString(), count: userIds.length };
}
