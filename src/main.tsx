import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { DonorProvider } from "./contexts/DonorContext";

createRoot(document.getElementById("root")!).render(
  <DonorProvider>
    <App />
  </DonorProvider>
);
