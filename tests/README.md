# Pruebas

## Prueba integral del circuito (`circuito.test.mjs`)

Corre contra el Supabase local con los datos de `seed.sql`:

```bash
npm run db:start
npm run db:reset
npm run functions:serve     # en otra terminal, para probar el correo
SUPABASE_ANON_KEY=<clave anon local> npm run test:circuito
```

Cubre: precios de las 8 combinaciones del catálogo, pedidos combinados, idempotencia, bloqueo de duplicados, validaciones, acceso sin sesión, permisos de cliente (no puede ver datos ajenos, marcar pagos, cambiar precios ni hacerse admin), flujo de entrega con cobro en efectivo, reglas de Mercado Pago, conservación del precio de compra, productos desactivados, correo idempotente e indicadores.

## Correo en local

Creá `supabase/functions/.env` con:

```
APP_URL=http://localhost:5173
MAILPIT_URL=http://supabase_inbucket_amarilla-gas:8025
EMAIL_FROM=Amarilla Gas <pedidos@amarillagas.com.ar>
```

Los correos llegan a Mailpit: <http://127.0.0.1:54324>. `MAILPIT_URL` es solo para desarrollo; en producción se usa Resend o SMTP (ver `docs/CONFIGURACION.md`).

## Si las Edge Functions no pueden descargar paquetes de npm

En redes con proxy corporativo, el contenedor de Supabase puede fallar al descargar `npm:@supabase/supabase-js`. Como alternativa local (no se sube al repositorio):

```bash
cd supabase/functions
npm init -y && npm i @supabase/supabase-js@2
echo "export * from '@supabase/supabase-js'" > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --platform=browser --outfile=.vendor/supabase-js.mjs && rm entry.mjs
for f in order-confirmation-email mp-create-preference mp-webhook; do
  echo '{ "imports": { "npm:@supabase/supabase-js@2": "../.vendor/supabase-js.mjs" } }' > $f/deno.json
done
```
