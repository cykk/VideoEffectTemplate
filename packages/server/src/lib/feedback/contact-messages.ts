import { nanoid } from "nanoid";
import { db } from "@markless/server/src/lib/db";
import { contactMessages } from "@markless/server/src/lib/db/schema";

export type ContactMessageStatus = "new" | "in_progress" | "resolved";

export interface CreateContactMessageInput {
  userId?: string | null;
  anonymousId?: string | null;
  email: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  status?: ContactMessageStatus;
}

function normalizeOptionalText(
  value?: string | null,
  maxLength = 2000,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeRequiredText(value: string, maxLength = 2000): string {
  return value.trim().slice(0, maxLength);
}

export async function createContactMessage(
  input: CreateContactMessageInput,
): Promise<{ id: string }> {
  const id = nanoid();
  const created = await db
    .insert(contactMessages)
    .values({
      id,
      userId: normalizeOptionalText(input.userId, 255),
      anonymousId: normalizeOptionalText(input.anonymousId, 255),
      email: normalizeRequiredText(input.email, 254),
      message: normalizeRequiredText(input.message, 2000),
      metadata: input.metadata ?? null,
      status: input.status ?? "new",
      updatedAt: new Date(),
    })
    .returning({ id: contactMessages.id });

  return { id: created[0]?.id ?? id };
}
