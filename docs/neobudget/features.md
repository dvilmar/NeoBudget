# Funcionalidades de NeoBudget

NeoBudget es un fork de Actual Budget que añade inversiones, deudas, multidivisa y utilidades de estilo Firefly III y Ghostfolio. Todo lo nuevo vive en módulos y tablas propios para poder integrar cambios de `upstream` sin conflictos.

## Inversiones

- Activos (acciones, fondos, criptomonedas) con divisa y fuente de precios (Yahoo Finance, CoinGecko) y operaciones de compra, venta, dividendo y comisión.
- Posiciones con coste medio, valor de mercado, ganancia latente y realizada, y dividendos cobrados; selector de método de coste (promedio o FIFO) para ver la ganancia realizada y el coste.
- Detalle de activo: resumen (cantidad, coste medio, valor, ganancia, dividendos, comisiones) y gráfico de precio.
- Calendario de dividendos: cobrados en los últimos 12 meses y estimación de los 3 siguientes.
- Actualización de precios y tipos de cambio desde el servidor, con refresco programado opcional.
- Importación de operaciones desde CSV y desde brokers (Interactive Brokers Flex).
- Importación manual del historial de Trade Republic (conexión no oficial, solo lectura, con PIN y código 2FA que no se guardan; ver `deployment.md`).
- Rendimiento de la cartera con comparación frente a un activo de referencia de la lista de seguimiento.
- Asignación de activos por tipo y divisa.
- Revisión de riesgo (X-Ray): concentración, divisa principal, peso en cripto y diversificación.
- Calculadora FIRE: objetivo y años estimados a partir de la cartera.
- Lista de seguimiento con importación de símbolos.
- Exportación CSV de operaciones y de la lista de seguimiento.

## Hucha

Objetivos de ahorro con importe meta y progreso, independientes de las categorías del presupuesto.

## Deudas

Deudas con saldo, tipo de interés y cuota, y cuadro de amortización calculado.

## Multidivisa

- Divisa propia por cuenta y divisa base del presupuesto.
- Tipos de cambio manuales o descargados y conversión de saldos al total.
- Importe en divisa extranjera por transacción, con sugerencia al tipo de cambio del día.
- Código de divisa visible en la barra lateral y en la cabecera de la cuenta.

## Suscripciones

Detección y seguimiento de pagos recurrentes con su coste mensual y anual.

## Extras de transacción

- Tipo de cambio y divisa extranjera.
- Enlaces entre transacciones.
- Adjuntos guardados en el servidor (8 MB como máximo, con validación de contenido).

## Webhooks

Avisos HTTP a servicios externos cuando cambian las transacciones. Máximo 20, validación SSRF (sin red local salvo `ACTUAL_WEBHOOKS_ALLOW_PRIVATE_NETWORK=true`), sin redirecciones y con límite de tasa.

## Actividad

Registro de auditoría de cambios en transacciones y otros datos.

## Insights

Informe de ingresos y gastos por periodo (mes, año, rango propio) agrupados por categoría, beneficiario o cuenta, más:

- Ingresos y gastos acumulados con tasa de ahorro mensual.
- Comparación del mes seleccionado con el mismo mes del año anterior por categoría.

## Servidor

- Rutas `/prices`, `/brokers`, `/attachments` y `/webhooks` en el `sync-server`.
- Refresco programado de cotizaciones (`ACTUAL_PRICES_REFRESH_MINUTES`).
- Guía de despliegue en `docs/neobudget/deployment.md`.
