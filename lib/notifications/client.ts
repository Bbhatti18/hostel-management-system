import { supabase } from "@/lib/supabase";
import type { NotificationEventType, NotificationRequestResult } from "@/lib/notifications/types";

const failedResult: NotificationRequestResult = {
  delivered: false,
  configurationRequired: false,
  warning: true,
};

export async function requestEventNotification(
  eventType: NotificationEventType,
  entityId: string,
): Promise<NotificationRequestResult> {
  try {
    let { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      const refreshed = await supabase.auth.refreshSession();
      data = refreshed.data;
    }
    const accessToken = data.session?.access_token;
    if (!accessToken) return failedResult;

    const response = await fetch("/api/notifications/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ eventType, entityId }),
    });
    if (!response.ok) return failedResult;

    const payload = (await response.json().catch(() => null)) as Partial<NotificationRequestResult> | null;
    return {
      delivered: payload?.delivered === true,
      configurationRequired: payload?.configurationRequired === true,
      warning: payload?.warning === true,
    };
  } catch {
    return failedResult;
  }
}

export function notificationWarning(result: NotificationRequestResult) {
  return result.warning
    ? " The record was saved, but its notification could not be delivered."
    : "";
}
