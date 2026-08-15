import ReactDOM from "react-dom/client";
import SidebarOwnerWindow from "../../registry/examples/sidebar/sidebar-owner-window";
import "./sidebar-owner-window.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<SidebarOwnerWindow />);
