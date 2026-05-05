import React from "react";
import ReactDOM from "react-dom/client";
import { KeyboardProvider } from "@diffgazer/keys";
import { App } from "./app";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <KeyboardProvider>
      <App />
    </KeyboardProvider>
  </React.StrictMode>,
);
