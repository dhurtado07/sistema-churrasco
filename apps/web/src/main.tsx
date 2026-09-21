import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";

// Si el navegador restaura una pantalla "congelada" (bfcache) al presionar
// atras/adelante, React nunca se vuelve a montar y la UI puede quedar
// desactualizada respecto a la sesion real (por ejemplo, mostrar una
// pantalla vieja de login aunque ya haya una sesion iniciada). Forzar una
// recarga en ese caso garantiza que siempre se re-evalue el estado actual.
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) {
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
