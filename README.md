# NeoBudget

Una sola app para el dinero de todos los días y para las inversiones: presupuesto por sobres, multidivisa, deudas, huchas, suscripciones y cartera de inversión, con tus datos en tu propio servidor.

NeoBudget es un fork de [Actual Budget](https://github.com/actualbudget/actual) (licencia MIT) al que se le han añadido ideas de [Firefly III](https://www.firefly-iii.org/) (multidivisa, deudas, huchas, suscripciones, webhooks) y de [Ghostfolio](https://ghostfol.io/) (inversiones y rentabilidad). Todo está reimplementado sobre la base de Actual; no se ha copiado código de proyectos AGPL.

> Estado: proyecto personal en desarrollo. Una parte de las integraciones con brokers todavía no se ha probado con cuentas reales (ver [Integraciones](#integraciones)).

## Qué incluye

**Presupuesto** (heredado de Actual)

- Presupuesto por sobres, cuentas, transacciones, reglas, calendario de pagos e informes.
- Sincronización entre dispositivos con servidor propio (SQLite, cifrado opcional de extremo a extremo).

**Lo que añade NeoBudget**

- **Resumen**: patrimonio neto, dinero por asignar, inversión, gasto restante por día, próximos pagos, huchas y mayores gastos del mes.
- **Inversiones**: posiciones con coste medio o FIFO, valor de mercado y ganancia, rentabilidad ponderada en el tiempo (sin que los ingresos de dinero la distorsionen) con comparación frente a un benchmark, dividendos y su calendario, reparto de la cartera, análisis de riesgo (X-Ray), calculadora FIRE con fondo de emergencia, lista de seguimiento, edición de activos y operaciones, importación de CSV y exportación a CSV.
- **Multidivisa**: divisa por cuenta, tipos de cambio, totales convertidos a tu divisa base e importe en divisa extranjera por transacción, con sugerencia al tipo del día.
- **Deudas**: préstamos e hipotecas con pagos, intereses, saldo pendiente y tabla de amortización.
- **Huchas**: objetivos de ahorro con movimientos vinculados a transacciones reales.
- **Suscripciones**: coste mensual y anual a partir de tus pagos programados.
- **Extras de transacción**: enlaces entre transacciones, adjuntos y registro de actividad.
- **Webhooks**: avisos a una URL propia cuando cambian tus transacciones.
- **Insights**: ingresos y gastos por periodo, tasa de ahorro y comparación con el mismo mes del año anterior.
- **Diseño propio**: tema claro limpio y tema oscuro, con la tipografía Geist.

La lista detallada está en [`docs/neobudget/features.md`](docs/neobudget/features.md).

## Integraciones

| Origen                                                     | Estado                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Interactive Brokers (Flex Web Service)                     | Implementado, sin probar con credenciales reales                                              |
| Trade Republic                                             | Implementado, **API no oficial** y sin probar contra el servicio real. El PIN nunca se guarda |
| CSV de brokers                                             | Funciona (formatos en inglés y español, sin duplicados al repetir)                            |
| Precios (Yahoo Finance, CoinGecko) y tipos de cambio (BCE) | Funciona a través del servidor                                                                |
| Bybit, Santander (Enable Banking)                          | Pendientes                                                                                    |

Las conexiones de brokers solo funcionan con servidor de sincronización conectado.

## Empezar

Requisitos: Node 22 o superior y Yarn 4.

```bash
yarn install
yarn start               # app en http://localhost:3001 (sin servidor: "Don't use a server" y "View demo")
yarn start:server-dev    # app con servidor de sincronización en http://localhost:5006
```

Para alojarlo en un Raspberry Pi, un VPS o un PC propio (variables de entorno, systemd, HTTPS y copias de seguridad), sigue [`docs/neobudget/deployment.md`](docs/neobudget/deployment.md).

## Estructura del código

- `packages/loot-core`: lógica, base de datos y cálculos (corre en cualquier plataforma).
- `packages/desktop-client`: interfaz web en React.
- `packages/desktop-electron`: aplicación de escritorio.
- `packages/sync-server`: servidor de sincronización, precios, brokers, adjuntos y webhooks.
- `packages/component-library`: componentes y temas.
- `docs/neobudget`: documentación propia de NeoBudget.

Las novedades de NeoBudget van en módulos y tablas nuevos, con migraciones solo aditivas, para poder traer los cambios de Actual (`upstream`) sin conflictos.

## Seguridad

- Tus datos viven en tu servidor. Usa HTTPS si lo expones fuera de tu red.
- Los PIN y las contraseñas de brokers no se guardan. Los tokens de Interactive Brokers se guardan como secretos del servidor.
- Los webhooks bloquean redes privadas por defecto y los adjuntos validan tipo y tamaño. Adjuntos y webhooks todavía no están ligados a un usuario concreto, así que no compartas el servidor con personas en las que no confíes.

## Contribuir

Revisa [`CLAUDE.md`](CLAUDE.md) y [`AGENTS.md`](AGENTS.md) para las reglas del repositorio, y [`CONTRIBUTING.md`](CONTRIBUTING.md) para el flujo general.

## Créditos y licencia

NeoBudget se basa en el trabajo de la comunidad de [Actual Budget](https://actualbudget.org). Gracias a sus autores y colaboradores.

Licencia MIT. Consulta [`LICENSE.txt`](LICENSE.txt).
