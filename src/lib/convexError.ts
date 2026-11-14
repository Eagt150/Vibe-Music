import { ConvexError } from "convex/values";

/** The error code a Convex function threw with `new ConvexError("CODE")`. */
export function convexErrorCode(error: unknown): string | null {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : null;
}
