# Configuración para producción

Esta guía deja la app funcionando en internet con un proyecto real de Supabase. Los pasos 1 a 4 son necesarios; el 5 (correo) y el 6 (Mercado Pago) se pueden hacer después: mientras no estén configurados la app funciona con pago en efectivo y avisa al cliente que el correo no está disponible, sin simular nada.

## 1. Crear el proyecto en Supabase

1. Entrá a <https://supabase.com>, creá una cuenta y un proyecto nuevo (región São Paulo, la más cercana a Argentina). Guardá la contraseña de la base.
2. En **Project Settings → API** copiá:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

   La clave *service_role* **no** va nunca en el frontend.

## 2. Crear las tablas y cargar los datos de prueba

**Opción A, sin instalar nada:** en Supabase abrí **SQL Editor**, pegá todo el contenido de `supabase/migrations/20261124000001_esquema_inicial.sql` y ejecutalo. Repetí con `supabase/migrations/20261127000001_cancelacion_y_avisos.sql` (cancelación por el cliente). Después hacé lo mismo con `supabase/seed.sql` (usuarios demo, productos y pedidos de ejemplo).

**Opción B, con la CLI:**

```bash
npx supabase login
npx supabase link --project-ref <ID-DEL-PROYECTO>
npx supabase db push          # aplica las migraciones
# los datos de prueba se cargan pegando supabase/seed.sql en el SQL Editor
```

> Si no querés usuarios demo en producción, no ejecutes `seed.sql` y cargá los productos desde el panel. Para crear el primer administrador, registrate desde la app y ejecutá en el SQL Editor:
> `update public.profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';`

## 3. Configurar la autenticación

En **Authentication → URL Configuration**:

- **Site URL:** la dirección pública de la app (por ejemplo `https://amarilla-gas.netlify.app`).
- **Redirect URLs:** agregá `https://amarilla-gas.netlify.app/**` (necesario para la recuperación de contraseña y la confirmación de correo).

En **Authentication → Providers → Email**:

- *Confirm email* activado exige que el cliente confirme su correo antes de comprar (recomendado). Para una demo en clase podés desactivarlo y el registro entra directo.
- Supabase envía los correos de registro y recuperación con un servidor propio limitado a pocos correos por hora. Para la demo alcanza; para uso real configurá **SMTP personalizado** en *Authentication → Emails → SMTP Settings* con los mismos datos del paso 5.

## 4. Publicar la app (Netlify o Vercel)

1. Subí el repositorio a GitHub.
2. En Netlify: **Add new site → Import from Git**, elegí el repo. El archivo `netlify.toml` ya define `npm run build` y la carpeta `dist`. En Vercel, el `vercel.json` hace lo mismo.
3. En **Environment variables** cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Abrí la URL desde el celular y usá “Agregar a pantalla de inicio” para instalarla como app (PWA).

## 5. Correos de pedidos

Los correos los envía la Edge Function `order-confirmation-email`: la confirmación al comprar y un aviso cada vez que el pedido pasa a *Pago confirmado*, *En preparación*, *En camino*, *Entregado* o *Cancelado*. Cada aviso se envía una sola vez por estado. Además, el negocio recibe un aviso interno por cada **pedido nuevo** y cada **cancelación hecha por el cliente** (con el motivo), en la dirección del secreto `ADMIN_EMAIL` (si no está, se usa `SMTP_USER`). Soporta dos proveedores; elegí uno.

**Opción A: Resend (recomendado)**

1. Creá una cuenta en <https://resend.com> y una API key.
2. Para enviar a cualquier destinatario hay que verificar un dominio propio en *Domains*. Sin dominio, Resend solo permite enviar al correo con el que te registraste (sirve para probar).
3. Secretos: `RESEND_API_KEY`, `EMAIL_FROM` (por ejemplo `Amarilla Gas <pedidos@tu-dominio.com.ar>`).

**Opción B: Gmail por SMTP**

1. En la cuenta de Google activá la verificación en dos pasos y generá una **contraseña de aplicación** (<https://myaccount.google.com/apppasswords>).
2. Secretos: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=tucuenta@gmail.com`, `SMTP_PASS=<contraseña de aplicación>`, `EMAIL_FROM=Amarilla Gas <tucuenta@gmail.com>`.

Con Gmail, `EMAIL_FROM` tiene que ser la misma cuenta que `SMTP_USER`: Gmail reemplaza cualquier otro remitente por la cuenta con la que se inicia sesión. Si también está cargado `RESEND_API_KEY`, la función usa Resend antes que SMTP, así que para enviar por Gmail hay que quitarlo (`npx supabase secrets unset RESEND_API_KEY`).

En ambos casos cargá también `APP_URL` con la dirección pública de la app (para el logo y el botón “Seguir mi pedido”).

Desplegar las funciones y cargar los secretos:

```bash
cp supabase/functions/.env.example supabase/functions/.env.produccion   # completalo
npx supabase secrets set --env-file supabase/functions/.env.produccion
npx supabase functions deploy order-confirmation-email
npx supabase functions deploy mp-create-preference
npx supabase functions deploy mp-webhook --no-verify-jwt
```

Cada envío queda registrado en la tabla `email_notifications` con su tipo (`confirmacion_pedido` o `estado_<estado>`) y estado `enviado`, `error` o `no_configurado`, y se ve en el historial del pedido dentro del panel.

## 6. Mercado Pago

1. Entrá a <https://www.mercadopago.com.ar/developers/panel/app> y creá una aplicación de tipo **Checkout Pro**.
2. En **Credenciales de prueba** copiá el **Access Token** (empieza con `APP_USR-` o `TEST-`). Para cobrar de verdad, usá luego las **credenciales de producción**.
3. En **Webhooks → Configurar notificaciones**:
   - URL: `https://<ID-DEL-PROYECTO>.supabase.co/functions/v1/mp-webhook`
   - Evento: **Pagos**
   - Copiá la **clave secreta** que muestra Mercado Pago.
4. Cargá los secretos y volvé a desplegar si hace falta:

   ```bash
   npx supabase secrets set MP_ACCESS_TOKEN=<access token> MP_WEBHOOK_SECRET=<clave secreta>
   ```

5. En la app, ingresá como admin → **Configuración** → activá **Habilitar pago electrónico**.

Cómo funciona:

- Al confirmar, el pedido se crea como **Pendiente de pago** y el cliente es redirigido a Mercado Pago.
- Cuando Mercado Pago notifica, `mp-webhook` valida la firma, **consulta el pago a la API de Mercado Pago** y recién ahí, si el estado es `approved` y el importe coincide, el pedido pasa a **Pago confirmado**.
- La página de regreso (`/pago/resultado`) no confía en los parámetros de la URL: lee el estado real desde la base.
- Desde el panel nadie puede marcar como pagado un pedido de Mercado Pago.

Para probar con dinero ficticio, Mercado Pago ofrece usuarios y tarjetas de prueba en la sección **Cuentas de prueba** del panel de desarrolladores.

## 7. Ajustes desde el panel

En **Panel → Configuración**:

- **Plazo de entrega:** texto que ve el cliente (por defecto “dentro de las próximas 2 horas”). Mientras *Disponibilidad operativa confirmada* esté desmarcado, se muestra como “plazo estimado”.
- **Pago electrónico:** activar o desactivar Mercado Pago.
- **Contacto:** teléfono y correo de atención.

En **Panel → Productos** se crean y editan productos, se cambian precios e imágenes (se suben a Supabase Storage) y se activan o desactivan. El precio “con carga” es siempre envase + carga asociada.

## Resumen de variables

| Dónde | Variable | Para qué |
|---|---|---|
| Netlify/Vercel | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Conexión pública del frontend |
| Supabase secrets | `APP_URL` | Enlaces del correo y retorno de Mercado Pago |
| Supabase secrets | `RESEND_API_KEY` **o** `SMTP_*` + `EMAIL_FROM` | Envío de correos |
| Supabase secrets | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Mercado Pago |
