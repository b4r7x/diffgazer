import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "./app/providers/app-providers";
import { router } from "./app/router";
import "./styles/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

ReactDOM.createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
