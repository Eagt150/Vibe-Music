import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import App from "./App";
import "./styles/global.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) throw new Error("VITE_CONVEX_URL is not set — run `npx convex dev` first");
const convex = new ConvexReactClient(convexUrl);

createRoot(rootEl).render(
  <StrictMode>
    <ConvexAuthProvider client={convex} api={api.auth}>
      <App />
    </ConvexAuthProvider>
  </StrictMode>
);
