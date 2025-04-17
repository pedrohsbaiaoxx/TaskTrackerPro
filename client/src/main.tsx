import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeDB } from "./lib/expenseStore";

// Initialize the IndexedDB before rendering the app
initializeDB().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
