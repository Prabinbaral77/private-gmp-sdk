import { ScannedRecord } from "@/types/scanner";


export const filterRecords = (
  records: readonly ScannedRecord[],
  programs: readonly string[],
  recordNames?: readonly string[],
): ScannedRecord[] => {
  const programSet = new Set(programs);
  const recordSet = recordNames?.length ? new Set(recordNames) : undefined;
  return records.filter((r) => {
    if (!programSet.has(r.program_name ?? '')) return false;
    if (recordSet && !recordSet.has(r.record_name ?? '')) return false;
    return true;
  });
}