# Amarilla Gas · Pedidos online de GLP

Aplicación web responsive (Mobile First) para la venta online de garrafas y cargas de Gas Licuado de Petróleo con entrega a domicilio. Trabajo final de diplomatura.

El cliente se registra, carga su domicilio, elige productos, paga en efectivo contra entrega o con Mercado Pago y sigue su pedido. La empresa gestiona pedidos, entregas, productos, precios y clientes desde un panel administrativo con indicadores.

## Qué incluye

| Módulo | Funcionalidad |
|---|---|
| Bienvenida | Logo, mensaje, botones de ingreso y registro, acceso al catálogo sin cuenta |
| Cuenta | Registro con validaciones, inicio de sesión, recuperación de contraseña, perfil editable |
| Domicilios | Varios domicilios por cliente, uno habitual, ubicación opcional en mapa (OpenStreetMap) |
| Catálogo | Cargas de 10 y 45 kg; envases plástico 10 kg, chapa 10 kg y 45 kg con opción “solo envase” o “con carga” |
| Carrito | Agregar, cambiar cantidades, eliminar, combinar productos, unitario, subtotal y total |
| Compra | Confirmación de domicilio, medio de pago, comentarios, pantalla de confirmación con número de pedido |
| Pagos | Efectivo contra entrega (pendiente hasta el cobro) y Mercado Pago Checkout Pro (confirmado solo por la pasarela) |
| Correo | Confirmación automática con diseño institucional (Resend o SMTP) |
| Mis pedidos | Historial, detalle, seguimiento por estados y “Volver a comprar” |
| Panel | Indicadores, pedidos con búsqueda y filtros, entregas, productos y precios, clientes, configuración |
| PWA | Instalable en Android/iPhone, con íconos y manifiesto |

## Tecnología

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS 4, React Router, Leaflet, Recharts.
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions en Deno).
- **Seguridad:** Row Level Security en todas las tablas, roles cliente/admin, precios y estados calculados en el servidor, contraseñas gestionadas por Supabase Auth (hash bcrypt).

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Puesta en marcha rápida (local)

Requisitos: Node 20+ y Docker.

```bash
npm install
npm run db:start            # levanta Supabase local (primera vez tarda unos minutos)
npm run db:reset            # crea las tablas y carga los datos de prueba
cp .env.example .env.local  # completá con la URL y la clave "anon" que muestra db:start
npm run dev                 # http://localhost:5173
```

Para probar el envío de correos en local ver [tests/README.md](tests/README.md). Los correos llegan al buzón de prueba Mailpit en http://127.0.0.1:54324.

Para publicar la app con un proyecto real de Supabase, Mercado Pago y correo, seguí **[docs/CONFIGURACION.md](docs/CONFIGURACION.md)**.

## Usuarios de demostración

Todos con la contraseña `Demo1234`:

| Usuario | Rol |
|---|---|
| admin@amarillagas.com.ar | Administrador |
| lucia.gomez@example.com | Cliente (2 domicilios, varios pedidos) |
| martin.perez@example.com | Cliente |
| sofia.rios@example.com | Cliente |

Los datos de prueba incluyen 11 pedidos de las últimas semanas en distintos estados para que el panel muestre indicadores.

## Guion sugerido para la demostración

1. Abrir la app en el celular y mostrar la pantalla de bienvenida.
2. **Registrarse** con un correo nuevo, mostrar las validaciones y cargar el domicilio marcando la ubicación en el mapa.
3. En el **catálogo**, agregar 2 cargas de 10 kg, una garrafa plástica **con carga** ($212.000) y una de chapa **sin carga** ($92.000).
4. En el **carrito**, cambiar cantidades y revisar el resumen.
5. **Confirmar** con efectivo contra entrega y mostrar la pantalla de confirmación y el correo recibido.
6. Abrir **Mis pedidos**, ver el seguimiento y usar **Volver a comprar**.
7. Ingresar como **admin**: indicadores, buscar el pedido, pasarlo a “En preparación”, “En camino” y “Entregado y cobrado”.
8. En **Productos**, cambiar el precio de la carga de 10 kg y mostrar que los combos se recalculan solos y que el pedido anterior conserva su precio.

## Pruebas

```bash
npm run db:reset
SUPABASE_ANON_KEY=<clave anon local> npm run test:circuito
```

14 pruebas automáticas recorren el circuito completo: precios de todas las combinaciones, pedidos combinados, idempotencia y bloqueo de duplicados, validaciones, permisos por rol, flujo de entrega con cobro en efectivo, reglas de Mercado Pago, conservación del precio histórico, productos desactivados, correo e indicadores.

## Estructura

```
src/
  pages/            pantallas del cliente
  pages/admin/      panel administrativo
  components/       componentes reutilizables
  context/          sesión, carrito y avisos
  lib/              cliente Supabase, tipos, formatos y validaciones
supabase/
  migrations/       esquema de base de datos, seguridad y funciones
  seed.sql          datos de prueba
  functions/        Edge Functions: correo y Mercado Pago
docs/               configuración y arquitectura
tests/              prueba integral del circuito de compra
```
