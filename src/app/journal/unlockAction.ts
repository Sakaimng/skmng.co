"use server";

import { redirect } from "next/navigation";

import { grantJournalAccess, passwordMatches, safeJournalPath } from "@/lib/journalGate.server";

export async function unlockJournalAction(
  _prev: { error: true; at: number } | null,
  formData: FormData,
) {
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    return { error: true as const, at: Date.now() };
  }

  await grantJournalAccess();
  redirect(safeJournalPath(String(formData.get("next") ?? "/journal")));
}
