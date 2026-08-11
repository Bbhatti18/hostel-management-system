export const notificationEventTypes = [
  "admission_created",
  "bill_generated",
  "receipt_submitted",
  "payment_verified",
  "payment_rejected",
  "contract_approved",
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];

export type NotificationRequestResult = {
  delivered: boolean;
  configurationRequired: boolean;
  warning: boolean;
};

export function isNotificationEventType(value: unknown): value is NotificationEventType {
  return notificationEventTypes.includes(value as NotificationEventType);
}
