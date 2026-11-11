import seed from "@/data/seed/fjordhus-2024-2025.json";
import { datasetSchema, type Dataset } from "./schema";

let cached: Dataset | undefined;

/**
 * Returns the fictional demo dataset, validated against the schema.
 * Validation runs once; a malformed file fails loudly instead of showing wrong numbers.
 */
export function getDataset(): Dataset {
  cached ??= datasetSchema.parse(seed);
  return cached;
}
