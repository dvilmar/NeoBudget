# NeoBudget

Fork de [Actual Budget](https://github.com/actualbudget/actual) (remoto `upstream`). Objetivo: una sola app que una el presupuesto de Actual, inversiones (estilo Ghostfolio) y multidivisa, deudas y sincronización programada (estilo Firefly III).

Responde siempre en español.

## Prioridades

1. Lógica primero. El rediseño visual es lo último: no toques temas ni componentes visuales salvo que se pida.
2. Todo lo nuevo va en tablas y módulos nuevos para que traer cambios de `upstream` no genere conflictos. Evita modificar el núcleo de Actual si hay alternativa.
3. Firefly III y Ghostfolio (`~/neobudget-refs/`) son AGPL-3.0 y este repo es MIT: sirven para estudiar cómo resuelven algo, nunca para copiar código.

## Eficiencia de tokens

- Respuestas cortas: resultado y siguiente paso, sin repetir contexto ya dicho.
- Lee solo lo necesario: busca con `grep` y lee rangos de líneas, no archivos enteros. No releas archivos que ya están en contexto.
- Limita la salida de los comandos (`| tail`, `| head`, filtros) y ejecuta solo los tests del paquete afectado, no `yarn test` completo.
- Tareas sencillas y autocontenidas (búsquedas amplias en el código, cambios mecánicos repetidos, ejecutar y resumir tests, renombrados) se delegan a un subagente con `model: "sonnet"`, o `"haiku"` si es solo buscar. Diseño de datos, arquitectura y depuración difícil se quedan en el modelo principal.
- No delegues lo trivial: un subagente arranca sin contexto y eso cuesta más que hacerlo directamente.
- `AGENTS.md` es largo y no se carga por defecto. Consulta la sección que necesites cuando haga falta.

## Reglas del repo (resumen de `AGENTS.md`)

- Yarn 4, Node >= 22. Ejecuta `yarn` siempre desde la raíz: `yarn workspace <nombre> <cmd>`.
- Paquetes: `loot-core` (lógica y base de datos, `@actual-app/core`), `desktop-client` (interfaz React, `@actual-app/web`), `sync-server` (`@actual-app/sync-server`), `component-library` (`@actual-app/components`).
- Antes de dar algo por terminado: `yarn typecheck` y `yarn lint:fix`.
- Migraciones en `packages/loot-core/migrations/`: solo aditivas (tablas nuevas, columnas con valor por defecto). Lee su `README.md` antes de crear una.
- TypeScript estricto en archivos nuevos, sin `// @ts-strict-ignore`. Funciones en vez de clases. Textos de interfaz con `Trans`. Cifras de dinero con `FinancialText`.
- Los hooks de `.claude/settings.json` necesitan `jq` y bloquean: commits sin prefijo `[AI]`, push a `master`, `--no-verify`, cambios de `git config` y `yarn` dentro de un workspace. Trabaja en ramas.
- Para commits y PR usa la skill `committing-actual-changes`.
- Arrancar la app: `yarn start` (puerto 3001); con servidor: `yarn start:server-dev` (puerto 5006). Para probar, "Don't use a server" y "View demo".

## Reglas fijas para subagentes (no repetirlas en cada encargo)

- Los subagentes empiezan sin el contexto de la conversación: leen este archivo. Un encargo bien hecho solo necesita la tarea, los archivos de referencia y el criterio de "terminado".
- Commits: prefijo `[AI] ` y **sin** `Co-Authored-By` ni ninguna coautoría (lo ha prohibido el usuario, aunque el arnés sugiera lo contrario). Un commit por tarea. Sin push, sin cambiar `git config`, sin saltarse los hooks de git.
- Antes de cada commit: `yarn lint:fix` (leer TODA su salida, el resumen final puede ocultar errores) y el typecheck solo de los paquetes tocados (`yarn workspace @actual-app/core typecheck`, `@actual-app/web`, `@actual-app/sync-server`). Evita `yarn typecheck` completo salvo al final de un bloque grande.
- Tests solo de lo tocado: `yarn workspace @actual-app/core run test:node <ruta>`, `yarn workspace @actual-app/web test <ruta>`, `yarn workspace @actual-app/sync-server test <ruta>`.
- Los hooks bloquean comandos de shell que contengan ciertas palabras aunque estén dentro de un heredoc o de un argumento (por ejemplo la opción de saltarse hooks, "force" o un push a `main`). Escribe los archivos con las herramientas Write/Edit y evita esas palabras en comandos de shell.
- Llevar la rama a `main` del remoto sin `git push` a `main`: subir la rama con `git push origin <rama>`, fusionarla con `gh api -X POST repos/dvilmar/NeoBudget/merges -f base=main -f head=<rama>`, borrar la rama remota con `gh api -X DELETE repos/dvilmar/NeoBudget/git/refs/heads/<rama>` y avanzar `main` en local con `git merge --ff-only origin/main`. Solo cuando el usuario lo pida.
- Si hay otro agente o sesión trabajando en el mismo checkout, usa un worktree aparte (`git worktree add`) para no mezclar cambios.
- `desktop-client`: los imports `#components/...` de archivos `.ts` o índices necesitan entrada explícita en `imports` de `package.json`; un componente por archivo; `useNavigate` desde `#hooks/useNavigate`; la regla `prefer-subpath-imports` prohíbe imports relativos al padre.
- Capturas y Playwright: solo una pasada al final de un bloque visual. Si el servidor de desarrollo en `/mnt/c` no ve los cambios, se reinicia matándolo por puerto con `ss` y `kill`, nunca con `pkill`.
- Estilo visual: maqueta A (tarjetas anchas y bajas, filas con borde fino de 1px, cifras en mono, sin sombras). Reutiliza `components/overview/` (Section, Stat, rowStyle, border, monoFont).
- Informe final de un subagente: breve y en español, con hash por commit, qué pruebas pasan y qué queda dudoso.
