import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("purge messages older than 3 days", { hours: 1 }, internal.messages.purgeExpired, {});

export default crons;
