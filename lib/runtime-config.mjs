// Opt in only for local development/test builds. Public releases default to live.
export const sampleModeEnabled =
  process.env.NEXT_PUBLIC_ENABLE_SAMPLE_MODE === "true";
export const supplierSampleCount = 184;
export const supplierSampleId = "supplier-list-20261016";
