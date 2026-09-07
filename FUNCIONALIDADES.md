# Funcionalidades — Sistema Churrasquería BRASA ARISP

Documento funcional: qué hace el sistema **hoy**, de cara al negocio, y qué le
falta para ser un POS completo. Para el diseño técnico (stack, modelo de
datos detallado, eventos WS, despliegue) ver [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## 1. Qué es

Punto de venta (POS) para **BRASA ARISP**, una churrasquería/parrilla, con
coordinación en tiempo real entre caja, cocina, parrilla y entrega,
impresión térmica de tickets, control de caja/dinero, compras e inventario,
empleados con asistencia, reportes financieros con gráficos, y un menú
público en la web. Es de un solo negocio (no multi-sucursal, no multi-tenant).

## 2. Funcionalidades existentes

### Autenticación y roles
- Login por usuario/contraseña, sesión JWT de 12 horas.
- 7 roles con permisos propios: `cajero`, `cocina`, `parrilla`, `entrega`,
  `admin`, `impresora` (cuenta técnica del agente de impresión), `empleado`
  (cuenta individual para marcar asistencia).
- Modo "kiosko" en las estaciones operativas: una cuenta por estación
  (cajero/cocina/parrilla/entrega), no por persona. Los empleados sí tienen
  cuenta individual, pero solo para marcar entrada/salida en `/asistencia`.
- El rol se valida en el servidor en cada endpoint, no solo ocultando
  botones en el frontend.

### Caja / POS (`/caja`)
- Arma el pedido desde el menú: producto + cantidad + extras.
- Asocia un cliente opcional (nombre/carnet), con autocompletado buscando en
  el directorio de clientes.
- Elige consumo en local (mesa obligatoria) o para llevar.
- **Método de pago** (efectivo/tarjeta/transferencia/QR) al cobrar.
- Marca como pagado → dispara ticket digital en pantalla (con nombre del
  negocio) + impresión térmica automática + registro automático del ingreso
  en el libro de caja.
- Botón "Reimprimir térmica" si la impresora falló (no bloquea el cobro).

### Cocina y Parrilla (`/cocina`, `/parrilla`)
- Colas FIFO independientes de pedidos pagados, en tiempo real (sin F5).
- Botón "Listo" con popup de confirmación (para evitar toques accidentales).
- Si un pedido no tiene ítems que requieran parrilla, esa rama se
  autocompleta sola.

### Entrega (`/entrega`)
- Ve todos los pedidos pagados, con foto de cada plato y cliente/mesa
  destacados.
- Ve en vivo el estado de cocina y parrilla de cada pedido.
- El botón "Entregado" solo se habilita cuando ambas ramas terminaron.

### Ciclo de vida del pedido
`PAGADO → COMPLETADO (cocina y parrilla listas) → ENTREGADO`, con rama
alterna `CANCELADO`. Un pedido solo se puede **editar o cancelar** mientras
nadie empezó a prepararlo — después hay que cancelarlo y cargar uno nuevo.
Editar o cancelar un pedido ajusta automáticamente el libro de caja (ver
abajo), nunca deja un ingreso "fantasma".

### Módulos configurables (`/admin/configuracion`)
- El admin puede apagar Cocina, Parrilla y/o Entrega según cómo opere el
  negocio (Caja siempre activa).
- Un módulo apagado se trata como "ya listo" automáticamente, y el pedido
  cae en cascada hasta donde alcancen los módulos activos.

### Identidad de marca
- Nombre del negocio, dirección, teléfono y NIT/RUC configurables desde
  `/admin/configuracion` (por defecto "BRASA ARISP").
- Se muestran en el ticket impreso (ESC/POS y modo archivo de prueba), en el
  ticket digital de caja, en la pantalla de login, y en el menú público.

### Control de caja y dinero (`/admin/caja-diaria`)
- **Apertura y cierre de turno**: el cajero registra con cuánto efectivo
  arranca, y al cerrar cuenta el efectivo real — el sistema calcula
  automáticamente el efectivo esperado (fondo inicial + ingresos en efectivo
  del turno) y la diferencia (faltante/sobrante).
- **Libro de ingresos y egresos**: cada venta genera su ingreso automático;
  se pueden registrar egresos manuales (compra de insumos, pago a
  proveedor, sueldo, servicios, otros) con concepto, monto y método de pago.
- **Nunca se edita ni se borra un movimiento**: anular uno crea un
  movimiento reverso (tipo opuesto, mismo monto) que lo neutraliza en los
  totales, y marca el original como anulado — todo el historial queda
  documentado para una auditoría o para que lo tome una contadora tal cual.
- Editar o cancelar un pedido pagado anula automáticamente su ingreso
  original y registra uno nuevo si corresponde (misma lógica de trazabilidad).

### Compras, proveedores e inversión (`/admin/proveedores`, `/admin/compras`)
- Directorio de proveedores (nombre, categoría, contacto, teléfono).
- Registro de compras de insumos (arroz, papa, verduras, carne, etc.) con
  ítems, cantidad, unidad y precio — es la **inversión** del negocio,
  separada de las ventas.
- Cada compra genera automáticamente su egreso correspondiente en el libro
  de caja, categorizado como "Compra de insumos".

### Inventario de bienes del local (`/admin/inventario`)
- Distinto del inventario de insumos (que se consume): activos fijos —
  sillas, mesas, televisores, equipo de cocina — con cantidad, estado
  (bueno/regular/malo/de baja) y valor estimado.

### Reportes financieros con gráficos (`/admin/reportes`)
- Filtro de período: hoy, últimos 7 días, este mes, este año, o un rango de
  fechas a medida.
- KPIs: ingresos, egresos, inversión en insumos, ganancia neta.
- Gráficos (Recharts): línea de ingresos vs. egresos vs. ganancia neta en el
  tiempo, barras de egresos por categoría, desglose de ingresos por método
  de pago.
- **Exportación a Excel** (financiero y nómina) generada en el servidor
  (con nombre del negocio en el encabezado) y **vista imprimible** con un
  botón dedicado.

### Empleados y asistencia (`/admin/empleados`, `/asistencia`)
- Alta de empleados: nombre, puesto, sueldo mensual, teléfono, y una cuenta
  de usuario/contraseña propia (rol `empleado`) para que puedan marcar su
  asistencia — independiente de las cuentas de estación.
- Pantalla de kiosko `/asistencia`: el empleado inicia sesión y un botón
  grande le permite marcar "Entrada" o "Salida" (el sistema sabe cuál toca
  según su última marca).
- Cálculo automático de horas trabajadas emparejando marcas entrada/salida,
  con reporte de nómina (sueldo vs. horas) filtrable por período y
  exportable a Excel.

### Panel Admin (`/admin/*`)
- **Ganancias**: dashboard rápido del día en vivo.
- **Reportes**: ver sección de reportes financieros arriba.
- **Pedidos**: pestañas Pendientes / Atendidos / Cancelados, editar/cancelar.
- **Caja y dinero, Compras, Proveedores, Inventario, Empleados**: ver
  secciones arriba.
- **Productos**: CRUD de menú y extras, con fotos (comprimidas en el
  navegador).
- **Clientes**: alta y búsqueda del directorio.
- **Configuración**: toggles de módulos + identidad de marca.
- Accesos embebidos a las 4 vistas de estación en vivo, sin salir del panel.
- Navegación agrupada (Negocio / Catálogo / Estaciones en vivo) con menú
  desplegable en mobile (la barra de tabs fija no alcanzaba para tantas
  secciones).

### Sitio público (`/menu`)
- Página sin login con el nombre, dirección/teléfono y el menú del negocio
  por categoría (con fotos), para que los clientes lo consulten desde su
  celular sin necesidad de cuenta.

### Impresión de tickets (`apps/print-agent`)
- Agente que corre en la PC de caja, escucha el evento de impresión por
  WebSocket, arma el ticket ESC/POS (con nombre/dirección/teléfono del
  negocio) y lo manda por red al puerto 9100 de la impresora térmica (o a
  un archivo local en modo de prueba, sin hardware).
- Reintenta 3 veces con backoff si falla el envío.
- El ticket digital en pantalla nunca depende de que la impresora responda.

### Tiempo real
12 eventos WebSocket cubren todo el flujo (pedido nuevo, cocina lista,
parrilla lista, completado, entregado, cancelado, actualizado, menú
actualizado, venta registrada, imprimir ticket, configuración actualizada,
movimiento de caja registrado). Cada pantalla se actualiza sola, sin recargar.

## 3. Flujo end-to-end típico

1. Cajero abre turno de caja (opcional, pero recomendado) con el fondo
   inicial en efectivo.
2. Arma el pedido con mesa, elige método de pago → cobra → entra a colas de
   cocina y parrilla en paralelo. El ingreso queda en el libro de caja.
3. Cocina marca listo, parrilla marca listo (en cualquier orden).
4. Al estar ambas listas, el pedido pasa a `COMPLETADO` (ya cuenta en
   ganancias y en reportes) y aparece en Entrega.
5. Entrega confirma → `ENTREGADO`.
6. Al fin del turno, el cajero cuenta el efectivo y cierra turno — el
   sistema muestra la diferencia contra lo esperado.
7. El dueño revisa `/admin/reportes` filtrando por el período que quiera,
   ve ingresos vs. inversión en insumos, y exporta a Excel si lo necesita.
8. En paralelo, desde el paso 2: ticket digital + impresión térmica
   automática (con reintento manual si falla).

## 4. Agregado en esta ronda (antes estaba en "lo que falta")

- **Gestión de cuentas de estación** (`/admin/usuarios`): el admin puede
  crear, renombrar, cambiar contraseña y activar/desactivar las cuentas de
  `cajero`, `cocina`, `parrilla`, `entrega`, `admin` e `impresora` — antes
  solo existían porque el seed las creaba. Protegido contra desactivar el
  último admin activo.
- **Cambiar mi contraseña** (`POST /auth/cambiar-password`, botón 🔒 junto a
  "Salir" en cualquier pantalla): disponible para cualquier cuenta logueada
  (estación o empleado). Es la "recuperación de contraseña" que tiene
  sentido en un sistema sin email — si se pierde del todo, el admin la
  resetea desde `/admin/usuarios` o `/admin/empleados`.
- **Rate limiting en el login**: máximo 20 intentos/minuto por IP en
  `/auth/login` y en `/auth/cambiar-password` (`@fastify/rate-limit`), más un
  límite global generoso (6000/min) contra un cliente descontrolado.
- **Auditoría de cambios en pedidos**: cada edición o cancelación guarda un
  snapshot de los ítems antes/después, quién lo hizo y cuándo
  (`PedidoAuditoria`), visible con el botón "Historial" en `/admin/pedidos`.
- **PIN para marcar asistencia**: cada empleado puede tener un PIN opcional
  (4-6 dígitos, configurable desde `/admin/empleados`) que se pide además de
  la sesión al marcar entrada/salida — evita que alguien marque por otro
  compartiendo un kiosko. Retrocompatible: sin PIN configurado, no se exige.
- **Documentación de API navegable** en `/docs` (Swagger UI /
  `@fastify/swagger`) — lista los ~44 endpoints con método y ruta, con
  soporte para autenticar con un Bearer token y probarlos a mano. No incluye
  todavía JSON Schema detallado por campo (las rutas validan con Zod a mano,
  no con el schema de Fastify), ni los eventos WebSocket (esos siguen solo en
  `ARCHITECTURE.md`).
- **Control de stock de insumos** (`/admin/insumos`): catálogo de insumos con
  stock actual/mínimo y alerta de "stock bajo"/"agotado". Cada producto puede
  tener una **receta** (cuánto de cada insumo consume una unidad vendida,
  editable desde "Productos" → botón "Receta") que descuenta stock
  automáticamente en cada venta y lo repone al cancelar/editar un pedido;
  cada compra puede linkearse a un insumo del catálogo para reponer stock
  automáticamente al registrarse. También admite un **ajuste manual**
  (`POST /insumos/:id/ajustar-stock`) para conteos físicos o mermas, porque
  ninguna receta es perfecta. La venta **nunca se bloquea** por falta de
  stock — es informativo, no un límite duro. No incluye todavía un historial
  de ajustes de stock (si hace falta auditarlos, se puede agregar una tabla
  de movimientos como la del libro de caja) ni conversión de unidades.

## 5. Lo que falta o está incompleto

### Calidad y operación del proyecto
- **Sin tests**: no hay ni un `.test.ts`/`.spec.ts` en el repo.
- **Sin CI/CD**: no hay `.github/workflows` ni pipeline de ningún tipo.
- **Sin métricas** (tipo Prometheus) para monitorear el servidor en
  producción — sí hay logs estructurados (pino) y healthcheck (`/health`).

### Seguridad
- **Sin revocación de sesión**: el JWT dura 12h y no hay refresh token ni
  lista de invalidación; "logout" es solo borrar el token en el cliente.

### Funcionalidad de negocio ausente
- **Sin descuentos ni promociones**, ni a nivel producto ni a nivel pedido.
- **Sin gestión real de mesas**: "mesa" es un texto libre en el pedido, no
  una entidad con estado (libre/ocupada) ni plano del local.
- **Sin paginación real**: las listas de pedidos, clientes y movimientos de
  caja cortan en un tope fijo en vez de paginar — en volumen alto se
  pierden registros de la vista.
- **Sin resiliencia offline**: si se cae internet en el local, caja/cocina/
  parrilla no pueden operar (ya está reconocido como pendiente — "Fase 4"
  en `ARCHITECTURE.md`).

## 6. Resumen

El sistema cubre hoy tanto el **flujo operativo** (tomar pedido → cocinar/
asar en paralelo → entregar → imprimir ticket) como el **flujo financiero y
de gestión** que pidió el dueño: control de caja con conteo de efectivo y
libro de ingresos/egresos trazable, compras a proveedores como inversión,
inventario de bienes del local, reportes con gráficos filtrables por
día/semana/mes/año exportables a Excel, empleados con sueldo y asistencia
por marcaje, e identidad de marca (BRASA ARISP) en tickets/login/menú
público, gestión de las cuentas de estación y de empleados (con auditoría de
cambios en pedidos, PIN de asistencia y documentación de API navegable), y
control de stock de insumos con recetas por producto. Lo que queda pendiente
es sobre todo lo que rodea a un sistema "listo para producción a gran
escala": pruebas automatizadas, CI/CD, descuentos, gestión real de mesas,
paginación, y resiliencia ante caídas de internet.
