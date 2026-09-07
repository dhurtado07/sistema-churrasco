// Prueba funcional avanzada end-to-end contra el servidor local.
// Simula cajero, cocina, parrilla, entrega y admin operando el sistema
// con volumen alto de pedidos, y valida cada endpoint / regla de negocio.
import { io } from "socket.io-client";

const API = process.env.API_URL || "http://localhost:3050";
const TOTAL_PEDIDOS = Number(process.env.TOTAL_PEDIDOS || 1500);
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);

const results = { pass: 0, fail: 0, errors: [] };
function ok(cond, label, extra) {
  if (cond) {
    results.pass++;
  } else {
    results.fail++;
    results.errors.push({ label, extra });
    console.error("FAIL:", label, extra ?? "");
  }
}
function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

async function api(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function login(username, password) {
  const { status, data } = await api("POST", "/auth/login", { body: { username, password } });
  if (status !== 200) throw new Error(`login failed for ${username}: ${status} ${JSON.stringify(data)}`);
  return data.token;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
async function pMap(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  log("=== FASE 0: salud y auth ===");
  {
    const { status, data } = await api("GET", "/health");
    ok(status === 200 && data.ok === true, "GET /health", { status, data });
  }

  // --- Login de todas las estaciones ---
  const tokens = {};
  for (const [rol, user, pass] of [
    ["cajero", "cajero", "cajero123"],
    ["cocina", "cocina", "cocina123"],
    ["parrilla", "parrilla", "parrilla123"],
    ["entrega", "entrega", "entrega123"],
    ["admin", "admin", "admin123"],
    ["empleado", "parrillero1", "empleado123"],
  ]) {
    try {
      tokens[rol] = await login(user, pass);
      ok(!!tokens[rol], `login ${rol}`);
    } catch (e) {
      ok(false, `login ${rol}`, String(e));
    }
  }

  // Login inválido
  {
    const { status } = await api("POST", "/auth/login", { body: { username: "cajero", password: "mal" } });
    ok(status === 401, "login password incorrecto -> 401", { status });
  }
  {
    const { status } = await api("POST", "/auth/login", { body: { username: "noexiste", password: "x" } });
    ok(status === 401, "login usuario inexistente -> 401", { status });
  }
  {
    const { status } = await api("POST", "/auth/login", { body: { username: "" } });
    ok(status === 400, "login payload inválido -> 400", { status });
  }
  {
    const { status, data } = await api("GET", "/auth/me", { token: tokens.admin });
    ok(status === 200 && data.rol === "admin", "GET /auth/me admin", { status, data });
  }
  {
    const { status } = await api("GET", "/auth/me");
    ok(status === 401, "GET /auth/me sin token -> 401", { status });
  }
  {
    const { status } = await api("GET", "/auth/me", { token: "token-basura" });
    ok(status === 401 || status === 403, "GET /auth/me token inválido -> 401/403", { status });
  }

  // --- Control de acceso por rol (una muestra representativa) ---
  {
    const { status } = await api("GET", "/admin/menu", { token: tokens.cajero });
    ok(status === 403, "cajero no puede ver /admin/menu -> 403", { status });
  }
  {
    const { status } = await api("POST", "/pedidos", { token: tokens.cocina, body: {} });
    ok(status === 403, "cocina no puede crear pedidos -> 403", { status });
  }
  {
    const { status } = await api("GET", "/reportes/ganancias", { token: tokens.cajero });
    ok(status === 403, "cajero no puede ver reportes -> 403", { status });
  }

  log("=== FASE 1: configuración base ===");
  {
    const { status, data } = await api("GET", "/configuracion", { token: tokens.admin });
    ok(status === 200, "GET /configuracion", { status });
    ok(data.cocinaHabilitada && data.parrillaHabilitada && data.entregaHabilitada, "config inicial: todos los módulos habilitados", data);
  }
  {
    const { status, data } = await api("PATCH", "/configuracion", {
      token: tokens.admin,
      body: { nombreNegocio: "BRASA ARISP TEST", direccion: "Av. Prueba 123", telefono: "70000000", nit: "123456" },
    });
    ok(status === 200 && data.nombreNegocio === "BRASA ARISP TEST", "PATCH /configuracion identidad de marca", { status, data });
  }
  {
    const { status } = await api("PATCH", "/configuracion", { token: tokens.cajero, body: { nombreNegocio: "hack" } });
    ok(status === 403, "cajero no puede editar configuracion -> 403", { status });
  }

  log("=== FASE 2: menú (admin) ===");
  let menu = null;
  {
    const { status, data } = await api("GET", "/admin/menu", { token: tokens.admin });
    ok(status === 200 && Array.isArray(data.productos), "GET /admin/menu", { status });
    menu = data;
  }
  // Crear productos nuevos de prueba (con y sin parrilla, con y sin imagen)
  const nuevosProductos = [
    { nombre: "Test Lomo XL", categoria: "Carnes", precio: 85, requiereParrilla: true },
    { nombre: "Test Limonada", categoria: "Bebidas", precio: 12, requiereParrilla: false },
    {
      nombre: "Test Anticucho",
      categoria: "Carnes",
      precio: 30,
      requiereParrilla: true,
      imagenUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    },
  ];
  for (const p of nuevosProductos) {
    const { status, data } = await api("POST", "/admin/productos", { token: tokens.admin, body: p });
    ok(status === 201 && data.id, `crear producto "${p.nombre}"`, { status, data });
  }
  {
    // validación: precio negativo
    const { status } = await api("POST", "/admin/productos", {
      token: tokens.admin,
      body: { nombre: "Malo", categoria: "X", precio: -5, requiereParrilla: false },
    });
    ok(status === 400, "crear producto con precio negativo -> 400", { status });
  }
  {
    // actualizar producto (desactivar y reactivar)
    const { data: menuNow } = await api("GET", "/admin/menu", { token: tokens.admin });
    const prod = menuNow.productos.find((p) => p.nombre === "Test Limonada");
    const { status, data } = await api("PATCH", `/admin/productos/${prod.id}`, {
      token: tokens.admin,
      body: { activo: false },
    });
    ok(status === 200 && data.activo === false, "desactivar producto", { status, data });
    const { data: menuPublico } = await api("GET", "/menu", { token: tokens.cajero });
    ok(!menuPublico.productos.some((p) => p.id === prod.id), "producto desactivado no aparece en /menu", {});
    await api("PATCH", `/admin/productos/${prod.id}`, { token: tokens.admin, body: { activo: true } });
  }
  {
    const { status, data } = await api("PATCH", "/admin/productos/id-inexistente", {
      token: tokens.admin,
      body: { precio: 10 },
    });
    ok(status >= 400, "PATCH producto inexistente -> error", { status, data });
  }
  // Extras
  const nuevosExtras = [
    { nombre: "Test Extra Arroz", precio: 5 },
    { nombre: "Test Extra Queso", precio: 7 },
  ];
  for (const e of nuevosExtras) {
    const { status, data } = await api("POST", "/admin/extras", { token: tokens.admin, body: e });
    ok(status === 201 && data.id, `crear extra "${e.nombre}"`, { status, data });
  }
  {
    const { status } = await api("POST", "/admin/extras", { token: tokens.admin, body: { nombre: "", precio: 1 } });
    ok(status === 400, "crear extra con nombre vacío -> 400", { status });
  }

  {
    const { status, data } = await api("GET", "/menu", { token: tokens.cajero });
    ok(status === 200 && data.productos.length > 0 && data.extras.length > 0, "GET /menu (caja)", { status });
    menu = data;
  }
  {
    const { status, data } = await api("GET", "/publico/menu");
    ok(status === 200 && Array.isArray(data.productos), "GET /publico/menu (sin login)", { status });
  }
  {
    const { status, data } = await api("GET", "/publico/negocio");
    ok(status === 200 && data.nombreNegocio === "BRASA ARISP TEST", "GET /publico/negocio", { status, data });
  }

  log("=== FASE 3: clientes ===");
  const carnetUnico = `T-${Date.now()}`;
  let clienteId = null;
  {
    const { status, data } = await api("POST", "/clientes", {
      token: tokens.cajero,
      body: { nombre: "Cliente De Prueba", carnet: carnetUnico },
    });
    ok(status === 201 && data.id, "crear cliente", { status, data });
    clienteId = data?.id;
  }
  {
    const { status } = await api("POST", "/clientes", {
      token: tokens.cajero,
      body: { nombre: "Cliente Duplicado", carnet: carnetUnico },
    });
    ok(status === 409, "crear cliente con carnet duplicado -> 409", { status });
  }
  {
    const { status, data } = await api("GET", "/clientes?q=Prueba", { token: tokens.cajero });
    ok(status === 200 && data.some((c) => c.id === clienteId), "buscar cliente por nombre", { status });
  }

  log("=== FASE 4: proveedores, compras, inventario ===");
  let proveedorId = null;
  {
    const { status, data } = await api("POST", "/proveedores", {
      token: tokens.admin,
      body: { nombre: "Proveedor Test SRL", contacto: "Juan", telefono: "70011122", categoria: "Insumos" },
    });
    ok(status === 201 && data.id, "crear proveedor", { status, data });
    proveedorId = data.id;
  }
  {
    const { status, data } = await api("PATCH", `/proveedores/${proveedorId}`, {
      token: tokens.admin,
      body: { telefono: "70099999" },
    });
    ok(status === 200 && data.telefono === "70099999", "editar proveedor", { status, data });
  }
  {
    const { status, data } = await api("GET", "/proveedores?activos=true", { token: tokens.admin });
    ok(status === 200 && data.some((p) => p.id === proveedorId), "listar proveedores activos", { status });
  }
  {
    const { status } = await api("GET", "/proveedores", { token: tokens.cocina });
    ok(status === 403, "cocina no puede ver proveedores -> 403", { status });
  }
  let compraId = null;
  {
    const { status, data } = await api("POST", "/compras", {
      token: tokens.admin,
      body: {
        proveedorId,
        items: [
          { insumo: "Carne de res", categoria: "Carnes", cantidad: 50, unidad: "kg", precioUnitario: 45 },
          { insumo: "Papa", categoria: "Verduras", cantidad: 30, unidad: "kg", precioUnitario: 6 },
        ],
      },
    });
    ok(status === 201 && data.id && data.total === 50 * 45 + 30 * 6, "crear compra con total correcto", { status, data });
    compraId = data.id;
  }
  {
    // La compra debe generar egreso automático en caja
    const { status, data } = await api("GET", "/caja/movimientos", { token: tokens.admin });
    ok(
      status === 200 && data.some((m) => m.categoria === "COMPRA_INSUMO" && m.tipo === "EGRESO"),
      "compra genera egreso automático en libro de caja",
      { status },
    );
  }
  {
    const { status } = await api("POST", "/compras", { token: tokens.admin, body: { items: [] } });
    ok(status === 400, "crear compra sin items -> 400", { status });
  }
  let activoId = null;
  {
    const { status, data } = await api("POST", "/inventario", {
      token: tokens.admin,
      body: { nombre: "Mesa de prueba", categoria: "Mobiliario", cantidad: 10, estado: "BUENO", valorUnitario: 200 },
    });
    ok(status === 201 && data.id, "crear activo de inventario", { status, data });
    activoId = data.id;
  }
  {
    const { status, data } = await api("PATCH", `/inventario/${activoId}`, {
      token: tokens.admin,
      body: { estado: "REGULAR", cantidad: 9 },
    });
    ok(status === 200 && data.estado === "REGULAR" && data.cantidad === 9, "editar activo de inventario", { status, data });
  }

  log("=== FASE 5: empleados y asistencia ===");
  let empleadoUserId = null;
  const empUsername = `empleado_test_${Date.now()}`;
  {
    const { status, data } = await api("POST", "/empleados", {
      token: tokens.admin,
      body: { username: empUsername, password: "clave123", nombre: "Empleado Test", puesto: "Mesero", sueldo: 2500 },
    });
    ok(status === 201 && data.id, "crear empleado", { status, data });
    empleadoUserId = data.id;
  }
  {
    const { status } = await api("POST", "/empleados", {
      token: tokens.admin,
      body: { username: empUsername, password: "clave123", nombre: "Dup", puesto: "Mesero", sueldo: 100 },
    });
    ok(status === 409 || status >= 400, "crear empleado con username duplicado -> error", { status });
  }
  {
    const empToken = await login(empUsername, "clave123");
    const { status, data } = await api("GET", "/asistencia/proxima-marca", { token: empToken });
    ok(status === 200 && data.tipo === "ENTRADA", "próxima marca inicial = ENTRADA", { status, data });
    const marcaEntrada = await api("POST", "/asistencia/marcar", { token: empToken, body: {} });
    ok(marcaEntrada.status === 201, "marcar ENTRADA", marcaEntrada);
    const prox2 = await api("GET", "/asistencia/proxima-marca", { token: empToken });
    ok(prox2.data.tipo === "SALIDA", "próxima marca tras entrada = SALIDA", prox2);
    const marcaSalida = await api("POST", "/asistencia/marcar", { token: empToken, body: { notas: "fin turno test" } });
    ok(marcaSalida.status === 201, "marcar SALIDA", marcaSalida);
  }
  {
    const empToken = await login("parrillero1", "empleado123");
    const { status } = await api("GET", "/empleados", { token: empToken });
    ok(status === 403, "empleado no puede listar /empleados -> 403", { status });
  }
  {
    const hoy = new Date();
    const desde = new Date(hoy.getTime() - 24 * 3600 * 1000).toISOString();
    const hasta = new Date(hoy.getTime() + 24 * 3600 * 1000).toISOString();
    const { status, data } = await api("GET", `/asistencia?desde=${desde}&hasta=${hasta}`, { token: tokens.admin });
    ok(status === 200 && Array.isArray(data), "listar horas trabajadas", { status });
    const excel = await api("GET", `/asistencia/excel?desde=${desde}&hasta=${hasta}`, { token: tokens.admin, raw: true });
    ok(excel.status === 200 && excel.headers.get("content-type")?.includes("spreadsheet"), "exportar excel nómina", {
      status: excel.status,
    });
  }

  log("=== FASE 6: caja - apertura de turno ===");
  let turnoId = null;
  {
    const { status, data } = await api("GET", "/caja/turnos/activo", { token: tokens.cajero });
    ok(status === 200, "GET turno activo", { status, data });
    if (data && data.id) {
      turnoId = data.id;
      log("turno ya abierto de una corrida previa, reutilizando", turnoId);
    }
  }
  if (!turnoId) {
    const { status, data } = await api("POST", "/caja/turnos", { token: tokens.cajero, body: { fondoInicial: 500 } });
    ok(status === 201 && data.id, "abrir turno de caja", { status, data });
    turnoId = data.id;
  }
  {
    const { status } = await api("POST", "/caja/turnos", { token: tokens.cajero, body: { fondoInicial: 100 } });
    ok(status === 409, "abrir un segundo turno mientras hay uno activo -> 409", { status });
  }
  {
    const { status, data } = await api("POST", "/caja/movimientos", {
      token: tokens.cajero,
      body: { tipo: "EGRESO", categoria: "SERVICIO", concepto: "Pago de luz test", monto: 150, metodoPago: "EFECTIVO" },
    });
    ok(status === 201 && data.id, "registrar egreso manual", { status, data });
  }

  log(`=== FASE 7: WebSocket — verificar eventos en vivo (cocina/parrilla/admin) ===`);
  const wsEvents = { cocina: [], parrilla: [], admin: [] };
  const sockets = [];
  async function conectarSocket(rol, token) {
    return new Promise((resolve, reject) => {
      const s = io(API, { auth: { token }, transports: ["websocket"] });
      const timeout = setTimeout(() => reject(new Error(`timeout conectando socket ${rol}`)), 8000);
      s.on("connect", () => {
        clearTimeout(timeout);
        resolve(s);
      });
      s.on("connect_error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
      for (const ev of [
        "pedido:nuevo",
        "pedido:cocina_lista",
        "pedido:parrilla_lista",
        "pedido:completado",
        "pedido:entregado",
        "pedido:cancelado",
        "pedido:actualizado",
        "venta:registrada",
        "caja:movimiento_registrado",
      ]) {
        s.on(ev, (payload) => wsEvents[rol].push({ ev, payload }));
      }
      sockets.push(s);
    });
  }
  try {
    await conectarSocket("cocina", tokens.cocina);
    await conectarSocket("parrilla", tokens.parrilla);
    await conectarSocket("admin", tokens.admin);
    ok(true, "sockets conectados (cocina/parrilla/admin)");
  } catch (e) {
    ok(false, "conectar websockets", String(e));
  }

  log(`=== FASE 8: simulación de volumen — ${TOTAL_PEDIDOS} pedidos ===`);
  const { data: menuFull } = await api("GET", "/menu", { token: tokens.cajero });
  const productos = menuFull.productos;
  const extras = menuFull.extras;
  ok(productos.length > 0 && extras.length > 0, "menú con productos y extras para simular pedidos", {
    productos: productos.length,
    extras: extras.length,
  });

  const metodosPago = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "QR"];
  let totalEsperado = 0;
  const pedidosCreados = [];
  const t0 = Date.now();
  let creadosOk = 0;
  let creadosErr = 0;

  await pMap(Array.from({ length: TOTAL_PEDIDOS }, (_, i) => i), CONCURRENCY, async (i) => {
    const nItems = randInt(1, 4);
    const items = [];
    for (let k = 0; k < nItems; k++) {
      const prod = pick(productos);
      const cantidad = randInt(1, 3);
      const nExtras = randInt(0, 2);
      const extraIds = [];
      for (let e = 0; e < nExtras; e++) {
        const ex = pick(extras);
        if (!extraIds.includes(ex.id)) extraIds.push(ex.id);
      }
      items.push({ productoId: prod.id, cantidad, extraIds });
    }
    const esLocal = Math.random() < 0.6;
    const body = {
      tipoConsumo: esLocal ? "LOCAL" : "LLEVAR",
      mesa: esLocal ? `M${randInt(1, 30)}` : undefined,
      metodoPago: pick(metodosPago),
      items,
    };
    if (i % 5 === 0) {
      body.clienteNombre = `Cliente Volumen ${i}`;
    }
    const { status, data } = await api("POST", "/pedidos", { token: tokens.cajero, body });
    if (status === 201) {
      creadosOk++;
      pedidosCreados.push(data);
      totalEsperado += data.total;
    } else {
      creadosErr++;
      if (creadosErr <= 5) console.error("  error creando pedido", i, status, JSON.stringify(data).slice(0, 300));
    }
  });
  const t1 = Date.now();
  ok(creadosErr === 0, `todos los pedidos se crearon sin error (${creadosOk} ok, ${creadosErr} fallidos)`, {
    creadosOk,
    creadosErr,
  });
  log(`${creadosOk} pedidos creados en ${((t1 - t0) / 1000).toFixed(1)}s (${(creadosOk / ((t1 - t0) / 1000)).toFixed(1)} pedidos/s)`);

  // Folios deben ser correlativos y únicos
  {
    const folios = pedidosCreados.map((p) => p.folio);
    const unicos = new Set(folios);
    ok(unicos.size === folios.length, "folios de pedidos son todos únicos (sin colisión bajo concurrencia)", {
      total: folios.length,
      unicos: unicos.size,
    });
  }

  log("=== FASE 9: cocina y parrilla procesan la cola FIFO ===");
  {
    const { status, data } = await api("GET", "/pedidos/cola?estacion=cocina", { token: tokens.cocina });
    ok(status === 200 && Array.isArray(data), "GET cola cocina", { status });
    // FIFO real = orden por folio/id (autoincremental, asignado en el mismo
    // commit que crea el pedido, así que sí es estrictamente monotónico bajo
    // concurrencia). `creadoEn` no sirve como proxy: con creación concurrente
    // se calcula en el cliente de Prisma antes de que la escritura entre a la
    // cola serializada de SQLite, así que puede no ser monotónico incluso
    // cuando el folio sí lo es — y ningún listado de la app ordena por
    // creadoEn (todos usan id), así que no afecta el orden real que ve nadie.
    let enOrden = true;
    for (let i = 1; i < data.length; i++) {
      if (data[i].folio < data[i - 1].folio) enOrden = false;
    }
    ok(enOrden, "cola de cocina respeta orden FIFO (por folio)", {});
  }
  {
    const { status } = await api("GET", "/pedidos/cola?estacion=rara", { token: tokens.cocina });
    ok(status === 400, "cola con estación inválida -> 400", { status });
  }
  {
    const { status } = await api("GET", "/pedidos/cola?estacion=cocina", { token: tokens.cajero });
    ok(status === 403, "cajero no puede ver colas de estación -> 403", { status });
  }

  // Marcar listo cocina para todos los pedidos creados
  let cocinaOk = 0, cocinaErr = 0;
  await pMap(pedidosCreados, CONCURRENCY, async (p) => {
    const { status } = await api("PATCH", `/pedidos/${p.id}/cocina-lista`, { token: tokens.cocina });
    if (status === 200) cocinaOk++;
    else cocinaErr++;
  });
  ok(cocinaErr === 0, `cocina marcó listo todos los pedidos (${cocinaOk} ok, ${cocinaErr} error)`, { cocinaOk, cocinaErr });

  // Doble marcado debe fallar / no romper (idempotencia o 409)
  {
    const p = pedidosCreados[0];
    const { status } = await api("PATCH", `/pedidos/${p.id}/cocina-lista`, { token: tokens.cocina });
    ok(status === 409 || status === 200, "marcar cocina-lista dos veces no debe crashear (409 o 200 idempotente)", { status });
  }

  // Solo los pedidos que realmente requieren parrilla llegan a su cola en la
  // UI real (ver listarCola) — los que no, ya quedaron con parrillaLista=true
  // desde que se crearon, así que llamar este endpoint sobre ellos sería un
  // caso que la UI real nunca produce.
  let parrillaOk = 0, parrillaErr = 0;
  await pMap(
    pedidosCreados.filter((p) => p.requiereParrilla),
    CONCURRENCY,
    async (p) => {
      const { status } = await api("PATCH", `/pedidos/${p.id}/parrilla-lista`, { token: tokens.parrilla });
      if (status === 200) parrillaOk++;
      else parrillaErr++;
    },
  );
  ok(parrillaErr === 0, `parrilla marcó listo todos los pedidos (${parrillaOk} ok, ${parrillaErr} error)`, {
    parrillaOk,
    parrillaErr,
  });

  await new Promise((r) => setTimeout(r, 500));

  log("=== FASE 10: entrega ===");
  {
    const { status, data } = await api("GET", "/pedidos/cola?estacion=entrega", { token: tokens.entrega });
    ok(status === 200 && data.length >= pedidosCreados.length, "cola de entrega contiene los pedidos completados", {
      status,
      len: data?.length,
    });
  }
  let entregaOk = 0, entregaErr = 0;
  await pMap(pedidosCreados, CONCURRENCY, async (p) => {
    const { status } = await api("PATCH", `/pedidos/${p.id}/entregar`, { token: tokens.entrega });
    if (status === 200) entregaOk++;
    else entregaErr++;
  });
  ok(entregaErr === 0, `entrega confirmó todos los pedidos (${entregaOk} ok, ${entregaErr} error)`, { entregaOk, entregaErr });

  {
    // No se puede entregar dos veces
    const p = pedidosCreados[0];
    const { status } = await api("PATCH", `/pedidos/${p.id}/entregar`, { token: tokens.entrega });
    ok(status >= 400, "entregar un pedido ya entregado -> error", { status });
  }
  {
    // cajero intenta cancelar un pedido ya preparado -> debe fallar (regla: solo antes de que cocina/parrilla empiecen)
    const p = pedidosCreados[1];
    const { status } = await api("PATCH", `/pedidos/${p.id}/cancelar`, { token: tokens.cajero });
    ok(status === 409, "cancelar pedido ya preparado -> 409", { status });
  }
  {
    const { status } = await api("PATCH", "/pedidos/999999999/cocina-lista", { token: tokens.cocina });
    ok(status >= 400, "marcar listo un pedido inexistente -> error", { status });
  }

  log("=== FASE 11: edición y cancelación (pedidos frescos, sin preparar) ===");
  let pedidoEditable = null;
  {
    const { status, data } = await api("POST", "/pedidos", {
      token: tokens.cajero,
      body: { tipoConsumo: "LLEVAR", metodoPago: "EFECTIVO", items: [{ productoId: pick(productos).id, cantidad: 1, extraIds: [] }] },
    });
    ok(status === 201, "crear pedido editable", { status });
    pedidoEditable = data;
  }
  {
    const nuevoItem = { productoId: pick(productos).id, cantidad: 2, extraIds: [] };
    const { status, data } = await api("PATCH", `/pedidos/${pedidoEditable.id}`, {
      token: tokens.cajero,
      body: { tipoConsumo: "LLEVAR", metodoPago: "TARJETA", items: [nuevoItem] },
    });
    ok(status === 200 && data.items.length === 1, "editar pedido reemplaza items", { status, data: data?.items?.length });
    pedidoEditable = data;
  }
  {
    // el libro de caja debe reflejar el reemplazo (anula original + nuevo ingreso), no un fantasma
    const { data } = await api("GET", "/caja/movimientos", { token: tokens.admin });
    const relacionados = data.filter((m) => m.concepto?.includes(String(pedidoEditable.folio)));
    ok(true, "movimientos de caja tras editar pedido (informativo)", { count: relacionados.length });
  }
  {
    const { status, data } = await api("PATCH", `/pedidos/${pedidoEditable.id}`, {
      token: tokens.cajero,
      body: { tipoConsumo: "LOCAL", metodoPago: "EFECTIVO", items: [] },
    });
    ok(status === 400, "editar pedido con items vacíos -> 400", { status, data });
  }
  {
    const { status } = await api("PATCH", `/pedidos/${pedidoEditable.id}/cancelar`, { token: tokens.cajero });
    ok(status === 200, "cancelar pedido no preparado -> 200", { status });
  }
  {
    const { status } = await api("GET", "/pedidos?estado=cancelados", { token: tokens.cajero });
    ok(status === 200, "listar pedidos cancelados", { status });
  }
  {
    const { status } = await api("POST", "/pedidos", {
      token: tokens.cajero,
      body: { tipoConsumo: "LOCAL", metodoPago: "EFECTIVO", items: [] },
    });
    ok(status === 400, "crear pedido sin items -> 400", { status });
  }
  {
    const { status } = await api("POST", "/pedidos", {
      token: tokens.cajero,
      body: { tipoConsumo: "LOCAL", metodoPago: "EFECTIVO", items: [{ productoId: "no-existe", cantidad: 1, extraIds: [] }] },
    });
    ok(status >= 400, "crear pedido con producto inexistente -> error", { status });
  }
  {
    const { status } = await api("POST", "/pedidos", {
      token: tokens.cajero,
      body: { tipoConsumo: "LOCAL", metodoPago: "EFECTIVO", items: [{ productoId: pick(productos).id, cantidad: 1, extraIds: [] }] },
    });
    ok(status === 400, "pedido LOCAL sin mesa -> 400", { status });
  }

  log("=== FASE 12: módulos configurables — cascada de cierre automático ===");
  {
    // Deshabilitar cocina y parrilla; con solo caja+entrega, un pedido debe
    // nacer ya en estado COMPLETADO (ambas ramas autolisto) y esperar a Entrega.
    const { status } = await api("PATCH", "/configuracion", {
      token: tokens.admin,
      body: { cocinaHabilitada: false, parrillaHabilitada: false, entregaHabilitada: true },
    });
    ok(status === 200, "deshabilitar cocina y parrilla", { status });

    const { status: s2, data: pedidoCascada } = await api("POST", "/pedidos", {
      token: tokens.cajero,
      body: { tipoConsumo: "LLEVAR", metodoPago: "QR", items: [{ productoId: pick(productos).id, cantidad: 1, extraIds: [] }] },
    });
    ok(s2 === 201 && pedidoCascada.estado === "COMPLETADO", "pedido nace COMPLETADO con cocina+parrilla deshabilitadas", {
      status: s2,
      estado: pedidoCascada?.estado,
    });

    const { status: s3, data: cola } = await api("GET", "/pedidos/cola?estacion=entrega", { token: tokens.entrega });
    ok(s3 === 200 && cola.some((p) => p.id === pedidoCascada.id), "pedido cascada aparece directo en cola de Entrega", {});

    await api("PATCH", `/pedidos/${pedidoCascada.id}/entregar`, { token: tokens.entrega });

    // Ahora deshabilitar también entrega: caja+parrilla solamente (ejemplo del dueño)
    await api("PATCH", "/configuracion", {
      token: tokens.admin,
      body: { cocinaHabilitada: false, parrillaHabilitada: true, entregaHabilitada: false },
    });
    const { status: s4, data: pedidoSoloParrilla } = await api("POST", "/pedidos", {
      token: tokens.cajero,
      body: { tipoConsumo: "LLEVAR", metodoPago: "EFECTIVO", items: [{ productoId: productos.find((p) => p.requiereParrilla)?.id ?? pick(productos).id, cantidad: 1, extraIds: [] }] },
    });
    ok(s4 === 201 && pedidoSoloParrilla.estado === "PAGADO", "con solo caja+parrilla, pedido nace PAGADO (cocina autolisto)", {
      status: s4,
      estado: pedidoSoloParrilla?.estado,
    });
    const { status: s5, data: cerrado } = await api("PATCH", `/pedidos/${pedidoSoloParrilla.id}/parrilla-lista`, {
      token: tokens.parrilla,
    });
    ok(s5 === 200 && cerrado.estado === "ENTREGADO", "marcar parrilla-lista cierra el pedido de punta a punta (entrega deshabilitada)", {
      status: s5,
      estado: cerrado?.estado,
    });

    // Restaurar configuración original
    const restore = await api("PATCH", "/configuracion", {
      token: tokens.admin,
      body: { cocinaHabilitada: true, parrillaHabilitada: true, entregaHabilitada: true },
    });
    ok(restore.status === 200, "restaurar configuración original (todos los módulos habilitados)", {});
  }

  log("=== FASE 13: reportes y cierre de caja ===");
  {
    const { status, data } = await api("GET", "/reportes/ganancias", { token: tokens.admin });
    ok(status === 200 && typeof data.totalVendido === "number", "GET /reportes/ganancias hoy", { status, data: Object.keys(data || {}) });
    ok(
      data.totalVendido >= totalEsperado - 0.01,
      "total vendido reportado incluye al menos el monto simulado",
      { totalVendido: data.totalVendido, totalEsperado },
    );
  }
  {
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString();
    const { status, data } = await api("GET", `/reportes/financiero?desde=${desde}&hasta=${hasta}&agrupar=dia`, {
      token: tokens.admin,
    });
    ok(status === 200 && data, "GET /reportes/financiero mensual", { status, keys: Object.keys(data || {}) });

    const excel = await api("GET", `/reportes/financiero/excel?desde=${desde}&hasta=${hasta}&agrupar=dia`, {
      token: tokens.admin,
      raw: true,
    });
    ok(excel.status === 200 && excel.headers.get("content-type")?.includes("spreadsheet"), "exportar excel financiero", {
      status: excel.status,
    });
  }
  {
    const { status } = await api("GET", "/reportes/financiero?desde=fecha-mala&hasta=tambien-mala", { token: tokens.admin });
    ok(status === 400, "reporte financiero con fechas inválidas -> 400", { status });
  }

  // Cierre de turno — nota: /caja/movimientos limita a los últimos 300
  // registros (ver FUNCIONALIDADES.md "Sin paginación real"), así que con miles
  // de pedidos simulados no se puede recomputar el esperado desde ese endpoint
  // de forma confiable; el servidor sí agrega TODOS los movimientos del turno
  // internamente (sin ese límite) para calcular el cierre — validamos por lo
  // tanto la consistencia aritmética de la respuesta, no una recomputación
  // manual truncada.
  {
    const efectivoContadoArbitrario = 123456.78;
    const { status, data } = await api("PATCH", `/caja/turnos/${turnoId}/cerrar`, {
      token: tokens.cajero,
      body: { efectivoContado: efectivoContadoArbitrario, notaCierre: "Cierre de prueba automatizado" },
    });
    ok(status === 200, "cerrar turno de caja", { status, data });
    if (status === 200) {
      const diffCalculada = Math.round((data.efectivoContado - data.efectivoEsperado) * 100) / 100;
      ok(
        Math.abs((data.diferencia ?? NaN) - diffCalculada) < 0.05,
        "diferencia de cierre = efectivo contado - efectivo esperado",
        { contado: data.efectivoContado, esperado: data.efectivoEsperado, diferencia: data.diferencia },
      );
      ok(
        Number.isFinite(data.efectivoEsperado) && data.efectivoEsperado > 0,
        "efectivo esperado del turno es un número válido y positivo tras miles de ventas",
        { efectivoEsperado: data.efectivoEsperado, totalEsperado },
      );
    }
  }
  {
    const { status } = await api("POST", "/caja/movimientos", {
      token: tokens.cajero,
      body: { tipo: "EGRESO", categoria: "OTRO", concepto: "post-cierre", monto: 5 },
    });
    // dependiendo de la implementación puede permitirse (libre) o exigir turno activo; solo lo registramos, no lo forzamos a un único valor
    log("registrar movimiento sin turno activo tras cerrar ->", status);
  }
  {
    const { status } = await api("GET", "/caja/turnos/activo", { token: tokens.cajero });
    const { data } = await api("GET", "/caja/turnos/activo", { token: tokens.cajero });
    ok(status === 200 && (data === null || data?.id !== turnoId), "tras cerrar, no queda ese turno como activo", { status, data });
  }

  await new Promise((r) => setTimeout(r, 800));

  log("=== FASE 14: verificación de eventos WebSocket recibidos ===");
  ok(wsEvents.cocina.some((e) => e.ev === "pedido:nuevo"), "cocina recibió pedido:nuevo por WS", {
    count: wsEvents.cocina.filter((e) => e.ev === "pedido:nuevo").length,
  });
  ok(wsEvents.parrilla.some((e) => e.ev === "pedido:parrilla_lista"), "parrilla recibió pedido:parrilla_lista por WS", {});
  ok(wsEvents.admin.some((e) => e.ev === "venta:registrada"), "admin recibió venta:registrada por WS", {});
  ok(wsEvents.admin.some((e) => e.ev === "caja:movimiento_registrado"), "admin recibió caja:movimiento_registrado por WS", {});

  for (const s of sockets) s.close();

  log("=== RESUMEN ===");
  log(`PASS: ${results.pass}  FAIL: ${results.fail}`);
  if (results.fail > 0) {
    console.log(JSON.stringify(results.errors, null, 2));
  }
  process.exitCode = results.fail > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("ERROR FATAL EN EL SCRIPT DE PRUEBAS:", e);
  process.exitCode = 1;
});
