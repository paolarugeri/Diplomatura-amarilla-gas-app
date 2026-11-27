# Arquitectura

## Visión general

```
Celular / PC (React PWA)
   │  HTTPS · clave anon + sesión del usuario (JWT)
   ▼
Supabase
   ├── Auth ............ registro, inicio de sesión, recuperación (contraseñas con hash bcrypt)
   ├── PostgreSQL ...... datos + RLS + funciones de negocio (create_order, admin_update_order…)
   ├── Storage ......... imágenes de productos (bucket "productos")
   └── Edge Functions .. order-confirmation-email · mp-create-preference · mp-webhook
                              │                          │                 ▲
                              ▼                          ▼                 │ notificación
                        Resend / SMTP              API Mercado Pago ───────┘
```

Se eligió **Supabase** por ser una base relacional real (PostgreSQL), con autenticación y permisos incorporados, plan gratuito suficiente para la demo y fácil de mantener: el esquema completo es un archivo SQL versionado.

## Modelo de datos

| Tabla | Contenido |
|---|---|
| `auth.users` | Usuarios (gestionado por Supabase Auth, contraseñas cifradas) |
| `profiles` | Clientes: nombre, correo, teléfono, **rol** (`cliente` / `admin` / `repartidor`) |
| `addresses` | Domicilios de cada cliente, con coordenadas opcionales y uno habitual |
| `products` | Cargas y envases: capacidad, tipo de envase, precio, imagen, activo, carga asociada |
| `product_prices` | Historial de precios (se completa solo con un trigger) |
| `orders` | Pedido: número único `AG-000000`, copia del domicilio y del cliente, medio y estado de pago, estado del pedido, total, plazo informado |
| `order_items` | Detalle: producto, opción con/sin carga, **precio unitario congelado** (envase + carga), cantidad, subtotal |
| `order_statuses` | Estados del pedido y de entrega |
| `payment_methods` | Medios de pago (efectivo, Mercado Pago) |
| `payment_statuses` | Estados de pago (pendiente, pagado, rechazado, reintegrado) |
| `payments` | Operaciones de pago registradas (preferencias y pagos de la pasarela, cobro en efectivo) |
| `order_status_history` | Línea de tiempo de cada pedido: quién cambió qué y cuándo |
| `email_notifications` | Registro de cada correo enviado o fallido |
| `audit_log` | Historial de modificaciones de productos, pedidos, configuración y perfiles |
| `store_settings` | Plazo de entrega, habilitación de Mercado Pago, datos de contacto |

### Precio dinámico

- El precio de un envase **con carga** no se guarda: se calcula como `precio del envase + precio de la carga asociada` (`products.refill_product_id`). Así nunca se duplican importes.
- Al comprar, `create_order` lee los precios **desde la base** (no desde el navegador) y los copia en `order_items`. Un cambio de precio posterior no modifica pedidos existentes.
- Restricciones `CHECK` en `order_items` garantizan `unit_price = envase + carga` y `subtotal = unit_price × cantidad`.

### Estados

Pedido: Pedido recibido → (Pendiente de pago → Pago confirmado) → En preparación → En camino → Entregado · Cancelado.

- **Efectivo:** empieza en *Pedido recibido* con pago *Pendiente*. Al entregar, el repartidor cobra y el pedido pasa a *Entregado* con pago *Pagado*.
- **Mercado Pago:** empieza en *Pendiente de pago*. Solo la notificación validada de la pasarela lo pasa a *Pago confirmado*. Hasta entonces no se puede preparar ni despachar.
- Un pedido *Entregado* o *Cancelado* ya no cambia de estado.

## Seguridad

- **RLS en todas las tablas.** Un cliente solo ve sus perfiles, domicilios y pedidos. El administrador ve todo mediante la función `is_admin()`. El repartidor ve solo los pedidos que tiene asignados (`orders.assigned_to`, función `is_driver()`).
- **Sin escritura directa de pedidos.** Se revocaron los permisos de `INSERT/UPDATE/DELETE` sobre pedidos, detalles, pagos e historial. Solo se modifican mediante funciones `SECURITY DEFINER` que validan permisos y reglas:
  - `create_order`: valida sesión, domicilio propio, productos activos, cantidades (1 a 20), medio de pago habilitado; calcula precios.
  - `admin_update_order`: exige rol admin y aplica las reglas de estados.
  - `admin_set_user_role` y `admin_assign_order`: solo un admin cambia perfiles (nunca el propio) y asigna pedidos a repartidores.
  - `driver_update_order`: el repartidor solo puede marcar sus pedidos "En camino" y "Entregado" (cobra el efectivo al entregar).
  - `cancel_my_order`: el cliente cancela solo sus pedidos, y solo mientras están en *Recibido* o *Pendiente de pago* y no están pagados.
  - `apply_mp_payment`: solo la puede ejecutar el servidor (`service_role`), desde el webhook.
- **El rol no se puede autoasignar:** el cliente solo puede modificar `full_name` y `phone` de su perfil (permiso por columna).
- **Prevención de pedidos duplicados:**
  1. Clave de idempotencia por intento de compra: si el navegador reintenta (doble clic, red lenta), se devuelve el mismo pedido.
  2. Bloqueo por cliente durante la creación (advisory lock) para evitar carreras.
  3. Huella del contenido: un pedido idéntico (mismos productos, domicilio y medio de pago) dentro de 2 minutos se rechaza con un aviso.
- **Pagos:** el webhook verifica la firma `x-signature` de Mercado Pago y vuelve a consultar el pago a la API antes de aplicarlo; controla importe y moneda.
- **Claves:** el frontend solo usa la clave pública `anon`. Tokens de Mercado Pago, correo y `service_role` viven como secretos de las Edge Functions.
- El panel administrativo oculta menús según el rol, pero la protección real está en la base: aunque alguien manipule la interfaz, la base rechaza la operación.

## Frontend

- Mobile First: barra inferior de navegación en celular, menú superior en escritorio.
- Carrito persistido en el navegador; los precios mostrados se recalculan con el catálogo vigente y se validan otra vez en el servidor.
- Validaciones en formularios (nombre y apellido, correo, teléfono, contraseña de 8+ caracteres con letras y números, código postal argentino de 4 dígitos o CPA) y también en la base (restricciones `CHECK`).
- PWA con `vite-plugin-pwa`: manifiesto, íconos y caché de imágenes.

## Preparado para crecer

- Nuevos medios de pago: agregar una fila en `payment_methods` y su función.
- Zonas o costos de envío: nueva tabla relacionada a `addresses` / `orders`.
- Avisos por WhatsApp: reutilizando `order_status_history` y la misma lógica de los avisos por correo.
- App de repartidor: la vista **Entregas** ya funciona como herramienta de reparto desde el celular.
