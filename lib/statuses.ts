export const BED_STATUS = {
  VACANT: "Vacant",
  OCCUPIED: "Occupied",
  INACTIVE: "Inactive",
} as const;

export type BedStatus = (typeof BED_STATUS)[keyof typeof BED_STATUS];
export type ReadableBedStatus = BedStatus | "Available";

export const ALLOCATABLE_BED_STATUSES = [
  BED_STATUS.VACANT,
  "Available",
] as const;

export const OPERATIONAL_BED_STATUSES = [
  BED_STATUS.VACANT,
  BED_STATUS.OCCUPIED,
  "Available",
] as const;

export function isAllocatableBedStatus(
  status: string | null | undefined,
): status is "Vacant" | "Available" {
  return status === BED_STATUS.VACANT || status === "Available";
}

export function isVacantBedStatus(status: string | null | undefined) {
  return isAllocatableBedStatus(status);
}

export function isOperationalBedStatus(
  status: string | null | undefined,
) {
  return OPERATIONAL_BED_STATUSES.some((value) => value === status);
}
