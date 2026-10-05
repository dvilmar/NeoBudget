# NeoBudget

**Presupuesto, deudas y inversiones en una sola app, con tus datos en tu propio servidor.**

![Licencia MIT](https://img.shields.io/badge/licencia-MIT-green)
![Node 22+](https://img.shields.io/badge/node-%3E%3D22-blue)
![Estado: en desarrollo](https://img.shields.io/badge/estado-en%20desarrollo-orange)

NeoBudget es un fork de [Actual Budget](https://github.com/actualbudget/actual) que le suma lo que echaba en falta: multidivisa, deudas, huchas y suscripciones al estilo de [Firefly III](https://www.firefly-iii.org/), y seguimiento de inversiones al estilo de [Ghostfolio](https://ghostfol.io/). Todo está reimplementado sobre la base de Actual; no se ha copiado código de proyectos AGPL.

- [Qué incluye](#qué-incluye)
- [Integraciones](#integraciones)
- [Empezar](#empezar)
- [Despliegue en tu servidor](#despliegue-en-tu-servidor)
- [Arquitectura](#arquitectura)
- [Seguridad y privacidad](#seguridad-y-privacidad)
- [Estado y hoja de ruta](#estado-y-hoja-de-ruta)
- [Contribuir](#contribuir)
- [Créditos y licencia](#créditos-y-licencia)

## Qué incluye

**Heredado de Actual Budget:** presupuesto por sobres, cuentas, transacciones, reglas, calendario de pagos, informes y sincronización entre dispositivos con servidor propio.

**Añadido por NeoBudget:**

| Área              | Qué hace                                                                                                                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resumen**       | Patrimonio neto, dinero por asignar, inversión, gasto restante por día, próximos pagos, huchas y mayores gastos del mes.                                                                                                                                                            |
| **Inversiones**   | Posiciones con coste medio o FIFO, valor y ganancia, rentabilidad ponderada en el tiempo con benchmark, dividendos y su calendario, reparto de la cartera, análisis de riesgo (X-Ray), calculadora FIRE y fondo de emergencia, lista de seguimiento, importación y exportación CSV. |
| **Multidivisa**   | Divisa por cuenta, tipos de cambio, totales convertidos a tu divisa base e importe en divisa extranjera por transacción con sugerencia al tipo del día.                                                                                                                             |
| **Deudas**        | Préstamos e hipotecas con pagos, intereses, saldo pendiente y tabla de amortización.                                                                                                                                                                                                |
| **Huchas**        | Objetivos de ahorro con movimientos vinculados a transacciones reales.                                                                                                                                                                                                              |
| **Suscripciones** | Coste mensual y anual a partir de tus pagos programados.                                                                                                                                                                                                                            |
| **Extras**        | Enlaces entre transacciones, adjuntos, registro de actividad y webhooks.                                                                                                                                                                                                            |
| **Insights**      | Ingresos y gastos por periodo, tasa de ahorro y comparación con el mismo mes del año anterior.                                                                                                                                                                                      |
| **Diseño**        | Tema claro y tema oscuro propios, con la tipografía Geist.                                                                                                                                                                                                                          |

El detalle de cada área está en [`docs/neobudget/features.md`](docs/neobudget/features.md).

## Integraciones

| Origen                                                     | Estado                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| CSV de brokers (inglés y español)                          | Funciona, sin duplicados al repetir la importación                                                 |
| Precios (Yahoo Finance, CoinGecko) y tipos de cambio (BCE) | Funciona a través del servidor                                                                     |
| Interactive Brokers (Flex Web Service)                     | Implementado, sin probar con credenciales reales                                                   |
| Trade Republic                                             | Implementado sobre una API **no oficial**, sin probar contra el servicio real. El PIN no se guarda |
| Bybit, Santander (Enable Banking)                          | Pendientes                                                                                         |

Las conexiones con brokers solo funcionan con el servidor de sincronización conectado.

## Empezar

Requisitos: Node 22 o superior y Yarn 4.

```bash
yarn install
yarn start               # app en http://localhost:3001
yarn start:server-dev    # app con servidor de sincronización en http://localhost:5006
```

Para probarla sin servidor, elige **Don't use a server** y **View demo**. Los brokers, adjuntos y webhooks necesitan servidor.

## Despliegue en tu servidor

La guía [`docs/neobudget/deployment.md`](docs/neobudget/deployment.md) cubre el servidor de sincronización en un Raspberry Pi, un VPS o un PC propio: compilación, variables de entorno, servicio systemd, proxy inverso con HTTPS y copias de seguridad.

## Arquitectura

| Paquete                      | Contenido                                                       |
| ---------------------------- | --------------------------------------------------------------- |
| `packages/loot-core`         | Lógica, base de datos y cálculos; corre en cualquier plataforma |
| `packages/desktop-client`    | Interfaz web en React                                           |
| `packages/desktop-electron`  | Aplicación de escritorio                                        |
| `packages/sync-server`       | Sincronización, precios, brokers, adjuntos y webhooks           |
| `packages/component-library` | Componentes y temas                                             |
| `docs/neobudget`             | Documentación propia de NeoBudget                               |

Lo nuevo de NeoBudget vive en módulos y tablas propios, con migraciones solo aditivas, para poder traer los cambios de Actual (`upstream`) sin conflictos.

## Seguridad y privacidad

- Tus datos viven en tu servidor. Si lo expones fuera de tu red, usa HTTPS.
- Los PIN y contraseñas de brokers no se guardan. Los tokens de Interactive Brokers se guardan como secretos del servidor, nunca en el código.
- Los webhooks bloquean redes privadas por defecto y los adjuntos validan tipo y tamaño.
- Adjuntos y webhooks todavía no están ligados a un usuario concreto: no compartas el servidor con personas en las que no confíes.
- La conexión con Trade Republic usa una API no oficial y va contra sus condiciones de uso. Úsala bajo tu responsabilidad.

## Estado y hoja de ruta

Proyecto en desarrollo. Pendiente:

- Traducciones al español.
- Reparto de la cartera por región y sector.
- Conectores de Bybit y Santander, y prueba real de Interactive Brokers y Trade Republic.
- Revisión visual del tema oscuro y de la versión móvil.
- Más informes y selector de divisa en más pantallas.

## Contribuir

Las reglas del repositorio están en [`CLAUDE.md`](CLAUDE.md) y [`AGENTS.md`](AGENTS.md); el flujo general, en [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Créditos y licencia

NeoBudget se basa en el trabajo de la comunidad de [Actual Budget](https://actualbudget.org). Gracias a sus autores y colaboradores.

Licencia MIT. Consulta [`LICENSE.txt`](LICENSE.txt).
