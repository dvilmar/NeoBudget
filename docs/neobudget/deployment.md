# Despliegue del servidor de sincronización

Guía para ejecutar el `sync-server` de NeoBudget en una Raspberry Pi (64 bits) o en un VPS Linux. Las rutas y usuarios son ejemplos: ajústalos.

## 1. Requisitos

- Node.js 22 o superior y Yarn 4 (`corepack enable`).
- Git y compilador básico (`build-essential`, `python3`) por si alguna dependencia nativa (SQLite) necesita compilarse en ARM.
- 1 GB de RAM libre como mínimo para compilar; después el servidor usa poco.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs git build-essential python3
sudo corepack enable
```

## 2. Obtener y compilar

```bash
sudo useradd --system --create-home --home-dir /opt/neobudget neobudget
sudo -u neobudget git clone <url-de-tu-repo> /opt/neobudget/app
cd /opt/neobudget/app
sudo -u neobudget yarn install
sudo -u neobudget yarn build:server
```

`yarn build:server` compila primero el cliente web (`build:browser`) y después el servidor (`vite build` en `packages/sync-server`). En una Raspberry Pi con poca memoria compila en otra máquina y copia el directorio, o añade swap.

Para arrancar a mano: `yarn start:server`.

## 3. Variables de entorno

Todas son opcionales salvo que se indique. Se pueden poner en un `EnvironmentFile` de systemd o en un `config.json` (ver `ACTUAL_CONFIG_PATH`).

### Básicas

| Variable                                                                                        | Para qué sirve                                                                                        | Por defecto                 |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------- |
| `ACTUAL_DATA_DIR`                                                                               | Directorio de datos (base de cuentas, archivos del servidor y de usuario). Recomendado fijarlo.       | `./data`                    |
| `ACTUAL_PORT` / `ACTUAL_HOSTNAME`                                                               | Puerto y dirección de escucha. Con proxy inverso usa `127.0.0.1`.                                     | `5006` / `::`               |
| `ACTUAL_SERVER_FILES`, `ACTUAL_USER_FILES`                                                      | Rutas concretas de archivos del servidor y de usuario. Los adjuntos van en `<userFiles>/attachments`. | dentro de `ACTUAL_DATA_DIR` |
| `ACTUAL_WEB_ROOT`                                                                               | Ruta del cliente web compilado.                                                                       | el del repo                 |
| `ACTUAL_TRUSTED_PROXIES`                                                                        | IPs o rangos del proxy inverso, para que la limitación de tasa vea la IP real del cliente.            | rangos privados             |
| `ACTUAL_UPLOAD_FILE_SIZE_LIMIT_MB`                                                              | Límite general de cuerpo JSON (también acota los adjuntos en base64).                                 | `20`                        |
| `ACTUAL_UPLOAD_FILE_SYNC_SIZE_LIMIT_MB`, `ACTUAL_UPLOAD_SYNC_ENCRYPTED_FILE_SYNC_SIZE_LIMIT_MB` | Límites de la sincronización.                                                                         | `20`                        |
| `ACTUAL_LOGIN_METHOD`, `ACTUAL_ALLOWED_LOGIN_METHODS`, `ACTUAL_OPENID_*`                        | Método de inicio de sesión (`password`, `header`, `openid`).                                          | `password`                  |
| `ACTUAL_HTTPS_KEY`, `ACTUAL_HTTPS_CERT`                                                         | HTTPS directo desde Node (no hace falta con proxy inverso).                                           | desactivado                 |

### Específicas de NeoBudget

| Variable                                | Para qué sirve                                                                                                                                                                                                         | Por defecto |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `ACTUAL_PRICES_REFRESH_MINUTES`         | Activa el refresco programado de cotizaciones: cada N minutos el servidor vuelve a pedir los símbolos que los clientes han consultado en `/prices/quotes` y responde desde memoria. Recuerda como máximo 500 símbolos. | desactivado |
| `ACTUAL_WEBHOOKS_ALLOW_PRIVATE_NETWORK` | Con `true` los webhooks pueden apuntar a `localhost` o a la red local (por ejemplo Home Assistant o n8n). Las direcciones de metadatos de nube siguen bloqueadas.                                                      | `false`     |

Otros detalles que conviene conocer:

- **Precios** (`/prices`): usan Yahoo Finance y CoinGecko sin clave, y los tipos de cambio del BCE. Son servicios gratuitos con límite de uso: no pongas un intervalo menor de 15 minutos.
- **Brokers** (`/brokers`): las credenciales de Interactive Brokers (token y `queryId` de Flex Query) se guardan como secretos del servidor desde la interfaz, no como variables de entorno. Trade Republic no guarda nada: ver la sección siguiente.
- **Adjuntos** (`/attachments`): máximo 8 MB por archivo, 5000 adjuntos y 60 subidas por minuto; se rechazan ejecutables, scripts y HTML.
- **Webhooks** (`/webhooks`): máximo 20, no siguen redirecciones y las URL se validan contra SSRF al crearlas y al enviar.

### Conector de Trade Republic (manual y no oficial)

Trade Republic no tiene API pública. El conector reimplementa desde cero la API privada que usa su aplicación web, solo para **leer** el historial de tu propia cuenta.

Qué hace, cada vez que pulsas el botón (nunca de forma programada):

1. Escribes teléfono (formato internacional, `+34…`) y PIN en Inversiones, Brokers, Trade Republic. El servidor inicia sesión en Trade Republic y te llega un código al móvil.
2. Escribes el código. El servidor lo confirma, descarga el historial (compras, ventas, planes de ahorro, dividendos, intereses y las comisiones e impuestos que aparezcan en el detalle) y lo devuelve normalizado. La aplicación lo importa sin duplicados (ids `tr:<id>`), así que repetir la importación solo añade lo nuevo.

Seguridad:

- **El PIN no se guarda nunca**: ni en disco, ni en la base de datos del servidor o del presupuesto, ni en secretos, registros, mensajes de error o sincronización. Se envía una vez a tu servidor, se usa en memoria para iniciar sesión y se descarta. La sesión de Trade Republic tampoco se guarda: solo vive mientras dura la descarga, así que cada importación pide PIN y código de nuevo.
- Entre el paso 1 y el 2 el servidor solo guarda en memoria el identificador del proceso de login, durante 5 minutos y para un único intento. Un código erróneo obliga a empezar de nuevo.
- Las rutas exigen la sesión del servidor de sincronización y admiten 5 intentos cada 10 minutos por usuario y por IP. El registro de peticiones no incluye cuerpos, y los errores son genéricos.
- El cliente solo puede llamar a `api.traderepublic.com` (login y lectura del historial) y no sigue redirecciones. No existe ninguna llamada para órdenes, retiradas ni cambios de cuenta.
- **HTTPS es obligatorio**: el PIN viaja del navegador a tu servidor. No uses este conector si accedes al servidor por HTTP fuera de tu máquina (ver la sección 5).

Riesgos que conviene conocer:

- Usar la API privada **va contra los términos de uso de Trade Republic**. Puede dejar de funcionar sin aviso y la cuenta podría quedar bloqueada temporalmente o revisada por intentos de login desde un servidor. Úsalo bajo tu responsabilidad.
- El protocolo no está verificado contra el servicio real: rutas, campos y tipos de evento son una suposición documentada en `packages/sync-server/src/app-brokers/traderepublic-*.ts` (marcas `UNVERIFIED`). Si algo no se reconoce, la importación lo cuenta en "Left out" en vez de inventarlo.
- El servidor necesita Node 22 o superior (usa el `WebSocket` integrado).

## 4. Servicio systemd

`/etc/neobudget.env`:

```ini
ACTUAL_DATA_DIR=/var/lib/neobudget
ACTUAL_PORT=5006
ACTUAL_HOSTNAME=127.0.0.1
ACTUAL_TRUSTED_PROXIES=127.0.0.1
ACTUAL_PRICES_REFRESH_MINUTES=30
```

`/etc/systemd/system/neobudget.service`:

```ini
[Unit]
Description=NeoBudget sync server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=neobudget
WorkingDirectory=/opt/neobudget/app
EnvironmentFile=/etc/neobudget.env
ExecStart=/usr/bin/node packages/sync-server/build/app.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/var/lib/neobudget

[Install]
WantedBy=multi-user.target
```

```bash
sudo install -d -o neobudget -g neobudget /var/lib/neobudget
sudo systemctl daemon-reload
sudo systemctl enable --now neobudget
journalctl -u neobudget -f
```

Para actualizar: `git pull`, `yarn install`, `yarn build:server` y `sudo systemctl restart neobudget`.

## 5. Proxy inverso con HTTPS

El servidor habla HTTP; deja que un proxy gestione los certificados. Ejemplo con Caddy (obtiene y renueva Let's Encrypt solo):

```caddyfile
presupuesto.example.com {
    encode zstd gzip
    request_body {
        max_size 25MB
    }
    reverse_proxy 127.0.0.1:5006
}
```

Con nginx usa `proxy_pass http://127.0.0.1:5006;`, `client_max_body_size 25m;`, las cabeceras `X-Forwarded-For` y `X-Forwarded-Proto`, y obtén el certificado con `certbot --nginx`.

Notas:

- Abre solo los puertos 80 y 443 en el cortafuegos; el 5006 queda en `127.0.0.1`.
- Si el servidor está en casa y quieres acceso externo sin abrir puertos, una VPN (WireGuard, Tailscale) es más segura que exponerlo.
- Al exponerlo a internet configura `ACTUAL_TRUSTED_PROXIES` con la IP del proxy.
- Cambia la contraseña inicial del servidor en el primer acceso.

## 6. Copias de seguridad

Todo el estado está en `ACTUAL_DATA_DIR`:

- `server-files/account.sqlite`: usuarios, sesiones, secretos y webhooks.
- `user-files/`: presupuestos sincronizados y `attachments/`.

Haz la copia con el servicio parado, o usa `sqlite3 account.sqlite ".backup copia.sqlite"` para la base de cuentas. Ejemplo diario con cron, en `/etc/cron.d/neobudget-backup`:

```cron
30 3 * * * root systemctl stop neobudget && tar czf /backup/neobudget-$(date +\%F).tgz -C /var/lib/neobudget . ; systemctl start neobudget
```

Y una limpieza semanal de copias de más de 30 días:

```cron
0 4 * * 0 root find /backup -name 'neobudget-*.tgz' -mtime +30 -delete
```

Copia los archivos también a otra máquina o a un almacenamiento remoto (`rclone`, `restic`), no solo a la misma tarjeta SD. Cada cliente guarda además su propia copia local del presupuesto, y desde la aplicación puedes exportarlo como respaldo adicional.

Para restaurar: para el servicio, vacía `ACTUAL_DATA_DIR`, extrae el archivo y arranca de nuevo.

## 7. Comprobaciones

- `curl -s http://127.0.0.1:5006/info` devuelve la versión y el estado.
- En la aplicación: Ajustes, servidor, y usa la URL pública.
- Si activaste el refresco de precios, el registro muestra `Scheduled price refresh enabled` al arrancar.
