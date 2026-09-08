import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { SocketProvider } from "./lib/socketContext";
import { ConfiguracionProvider } from "./lib/configuracionContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { CajaPage } from "./pages/CajaPage";
import { CocinaPage } from "./pages/CocinaPage";
import { ParrillaPage } from "./pages/ParrillaPage";
import { EntregaPage } from "./pages/EntregaPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminGananciasPage } from "./pages/admin/AdminGananciasPage";
import { AdminProductosPage } from "./pages/admin/AdminProductosPage";
import { AdminClientesPage } from "./pages/admin/AdminClientesPage";
import { AdminPedidosPage } from "./pages/admin/AdminPedidosPage";
import { AdminConfiguracionPage } from "./pages/admin/AdminConfiguracionPage";
import { AdminCajaPage } from "./pages/admin/AdminCajaPage";
import { AdminProveedoresPage } from "./pages/admin/AdminProveedoresPage";
import { AdminComprasPage } from "./pages/admin/AdminComprasPage";
import { AdminInventarioPage } from "./pages/admin/AdminInventarioPage";
import { AdminEmpleadosPage } from "./pages/admin/AdminEmpleadosPage";
import { AdminUsuariosPage } from "./pages/admin/AdminUsuariosPage";
import { AdminInsumosPage } from "./pages/admin/AdminInsumosPage";
import { AsistenciaKioskoPage } from "./pages/AsistenciaKioskoPage";
import { AdminReportesPage } from "./pages/admin/AdminReportesPage";
import { MenuPublicoPage } from "./pages/MenuPublicoPage";
import { LandingPage } from "./pages/LandingPage";

export function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ConfiguracionProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/menu" element={<MenuPublicoPage />} />
            <Route
              path="/asistencia"
              element={
                <ProtectedRoute soloEmpleado>
                  <AsistenciaKioskoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/caja"
              element={
                <ProtectedRoute roles={["cajero", "admin"]}>
                  <CajaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cocina"
              element={
                <ProtectedRoute roles={["cocina", "admin"]} modulo="cocinaHabilitada">
                  <CocinaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parrilla"
              element={
                <ProtectedRoute roles={["parrilla", "admin"]} modulo="parrillaHabilitada">
                  <ParrillaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/entrega"
              element={
                <ProtectedRoute roles={["entrega", "admin"]} modulo="entregaHabilitada">
                  <EntregaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminGananciasPage />} />
              <Route path="pedidos" element={<AdminPedidosPage />} />
              <Route path="productos" element={<AdminProductosPage />} />
              <Route path="clientes" element={<AdminClientesPage />} />
              <Route path="configuracion" element={<AdminConfiguracionPage />} />
              <Route path="caja-diaria" element={<AdminCajaPage />} />
              <Route path="proveedores" element={<AdminProveedoresPage />} />
              <Route path="compras" element={<AdminComprasPage />} />
              <Route path="inventario" element={<AdminInventarioPage />} />
              <Route path="empleados" element={<AdminEmpleadosPage />} />
              <Route path="usuarios" element={<AdminUsuariosPage />} />
              <Route path="insumos" element={<AdminInsumosPage />} />
              <Route path="reportes" element={<AdminReportesPage />} />
              {/* Vistas embebidas de las estaciones — el admin ve exactamente
                  lo mismo que caja/cocina/parrilla, en vivo, para seguir cómo
                  van las órdenes sin salir de su panel. Sin `modulo`: el admin
                  siempre puede entrar a revisar, aunque el módulo esté
                  deshabilitado para el resto (esas colas van a estar vacías). */}
              <Route path="caja" element={<CajaPage />} />
              <Route path="cocina" element={<CocinaPage />} />
              <Route path="parrilla" element={<ParrillaPage />} />
              <Route path="entrega" element={<EntregaPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ConfiguracionProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
