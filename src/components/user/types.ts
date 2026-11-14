import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

/** The public shape of a user (convex/lib.ts PublicUser), as the client sees it. */
export type PublicUser = FunctionReturnType<typeof api.friends.list>["friends"][number]["user"];
export type Profile = NonNullable<FunctionReturnType<typeof api.users.getProfile>>;
