import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./app/router";
import { AppProviders } from "./app/providers";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <RouterProvider router={router} />
  </AppProviders>
);
