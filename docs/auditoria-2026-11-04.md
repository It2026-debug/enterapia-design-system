# Auditoría completa — 4 de noviembre de 2026

Revisión de punta a punta del repositorio `enterapia-design-system` en el estado de `main` tras el pull request #2 (commit `b013f85`): importador, generación de tokens y sitio, 20 componentes, servidor MCP, flujos de GitHub Actions, Docker, dependencias y el sitio publicado.

## Resultado

Se encontraron **42 hallazgos**. **35 están corregidos y verificados**; 7 no se corrigen (3 requieren una decisión o un permiso tuyo, 4 son decisiones de diseño aceptadas o mejoras opcionales).

| Severidad | Hallazgos | Corregidos |
| --- | ---: | ---: |
| Crítico | 1 | 1 |
| Alto | 4 | 4 |
| Medio | 13 | 11 |
| Bajo | 19 | 19 |
| Informativo | 5 | 0 |

**Antes y después, con las mismas herramientas:**

| Comprobación | Antes | Después |
| --- | --- | --- |
| axe-core en las 31 páginas, tema claro | 4 reglas incumplidas, 60 elementos | **0** |
| axe-core, tema oscuro | 4 reglas, 60 elementos | **0** |
| axe-core a 390 px (celular) | lo anterior más 27 elementos con desplazamiento inalcanzable; 1 página se desbordaba 41 px | **0**, sin desbordamiento |
| Validador de HTML, errores de estructura (sin contar estilo del doctype ni roles ARIA de diseño) | 101 | **2** (el mismo `<nav>` real y su copia en una `<template>` inactiva; en el DOM real hay uno) |
| ESLint y Stylelint | 5 avisos de ESLint (uno intencional) y 1 de Stylelint | **0** |
| Medidas de las 191 variantes frente a Figma | 191 de 191 | **191 de 191** (sin regresión) |
| Pruebas automáticas | 69 | **93** |
| `npm audit` | 0 | **0** |

El aviso `prefer-native-element` del validador (roles ARIA sobre `div`) pasó de 75 a 118 porque los contenedores nuevos de la documentación (`role="table"`, `role="listbox"`) añaden más ocurrencias del mismo patrón; es la decisión de diseño aceptada en AUD-39.

## Alcance y método

- **Código y datos:** lectura del código, pruebas dirigidas con casos construidos a propósito para cada sospecha (sección "Evidencia" de cada hallazgo), lint de JavaScript (ESLint) y de CSS (Stylelint).
- **Sitio:** las 31 páginas generadas, en un navegador real (Chrome), con axe-core 4.10 en tema claro, oscuro y a 390 px de ancho; validación de HTML con html-validate; pruebas funcionales de la vista previa, el filtro, el tema y el menú; rastreo del sitio publicado (39 recursos, todos responden 200).
- **Servidor MCP:** casos límite (entradas vacías, enormes o mal formadas, tipos de contenido erróneos, 300 peticiones concurrentes, cierre con una conexión abierta).
- **Infraestructura:** versiones de las acciones de GitHub, permisos, Dockerfile (leído, sin construir la imagen), configuración del repo, secretos en el historial, dependencias.

**No se pudo verificar:** la imagen de Docker (no está instalado), los flujos de GitHub Actions con el código corregido (se comprobarán en el pull request), el modo de alto contraste forzado de Windows (no hay forma de emularlo con las herramientas disponibles) y la lectura real con lectores de pantalla (VoiceOver, NVDA): axe detecta violaciones, pero no sustituye una prueba con personas.

**Incidente durante la auditoría:** una de mis pruebas (la del hallazgo AUD-01) pasó por error la carpeta temporal de trabajo como carpeta de salida del build, y el build la vació. Solo se perdieron mis propios archivos auxiliares (scripts de análisis, el validador y axe, que reinstalé); no se tocó nada del repositorio ni de tus archivos. Es la prueba más contundente del hallazgo.

---

## Hallazgos corregidos

### Integridad y seguridad

**AUD-01 · Alto · `build()` vacía cualquier carpeta que se le pase.**
`build({ outDir })` ejecutaba `rmSync(outDir, { recursive: true })` sin ninguna comprobación. *Evidencia:* al pasarle una carpeta de trabajo, la borró entera y escribió el sitio dentro. *Corrección:* `assertSafeOutDir` rechaza la raíz del disco, el home, el repositorio y sus carpetas padre, y cualquier carpeta no vacía que no haya creado el propio build (lleva un archivo marcador `.ds-build`). `dist/` sigue funcionando sin cambios. *Pruebas:* `audit.test.mjs`.

**AUD-02 · Medio · URLs `javascript:` aceptadas en `SITE_URL` y `MCP_URL`.**
Se insertaban como `href` solo con escape HTML. *Evidencia:* con `mcpUrl: "javascript:alert(1)"` el enlace salía en 31 páginas. *Corrección:* `assertHttpUrl` exige `http:` o `https:`. *Pruebas:* `audit.test.mjs`.

**AUD-03 · Alto · El importador escribe datos vacíos si el `.fig` no es el correcto, y no escribe de forma atómica.**
*Evidencia:* con un documento sin colecciones devolvía `{}` para primitivos y semánticos, y el comando los escribía sobre `tokens/`, rompiendo el sistema entero. Además escribía los tokens antes de extraer la documentación: un fallo posterior dejaba el repo a medias. *Corrección:* el importador extrae todo primero, comprueba que el archivo parezca el de Enterapia (`import-checks.mjs`) y solo entonces escribe. Sigue siendo idempotente sobre el archivo real.

**AUD-04 · Bajo · Documentación leída por posición sin avisar si el formato no coincide.**
La documentación del formato anterior se asignaba por índice (`texts[2]`, `texts[3]`…). Si el diseño cambiaba un bloque, el texto quedaba en el lugar equivocado sin ningún aviso. *Corrección:* el importador devuelve y muestra advertencias cuando un documento no encaja en ninguno de los dos formatos conocidos.

### Lógica de datos

**AUD-05 · Medio · Un alias de un token con modo oscuro no se reconocía como tal.**
`color.alias = "{color.page}"` se escribe igual en claro y oscuro, pero resuelve a valores distintos. El registro, el sitio, `llms.txt` y el MCP mostraban solo el valor claro. *Evidencia:* `modes: null` y `withDarkVariant` subcontado. *Corrección:* la variante oscura se decide comparando lo que cada modo resuelve, no solo cómo se escribe. Los datos actuales no cambian (siguen siendo 50), pero cualquier alias futuro quedaba mal. *Pruebas:* `audit.test.mjs`.

**AUD-06 · Bajo · El cálculo de contraste ignoraba la transparencia.**
`#00091c` al 50 % sobre blanco daba 19,89:1; el valor real es 3,76:1. Ningún par actual usa transparencia, pero un par futuro habría pasado en falso. *Corrección:* se compone el color con su fondo antes de medir. *Pruebas:* `audit.test.mjs`.

### Accesibilidad del sitio

**AUD-07 · Crítico · Roles ARIA sin su contenedor obligatorio (24 elementos).**
Las vistas previas de Select Option (`role="option"`) y de las piezas de Tabla (`row`, `cell`, `columnheader`) aparecían solas. *Evidencia:* axe `aria-required-parent`, en claro y oscuro. *Corrección:* en la documentación cada pieza se muestra dentro de un contenedor con el rol correcto (`listbox` o `table`); el código mostrado no incluye ese contenedor.

**AUD-08 · Alto · Contraste de color insuficiente (15 elementos).**
El texto "No existe" de las matrices usaba el color de texto deshabilitado (2,07:1 en claro, 4,2:1 en oscuro), que solo está exento en controles realmente deshabilitados. Además, la tabla de contraste mostraba muestras "Aa" con el color de un borde (3,65:1), que axe leía como texto. *Corrección:* "No existe" usa el color secundario del cuerpo; los pares de 3:1 (bordes, íconos, gráficas) muestran una muestra visual, no texto.

**AUD-09 · Medio · Saltos en el orden de encabezados (19 páginas).**
Las páginas de Foundations pasaban de `h1` a `h3`; las de componentes, de `h2` a `h4`. *Corrección:* los grupos son `h2` con el mismo aspecto, y "Hacer / Evitar" y las matrices usan el nivel correcto.

**AUD-10 · Medio · Regiones (landmarks) vacías o duplicadas.**
Cada vista previa creaba `<section aria-label="">` (nombre vacío), varias secciones de tokens compartían el nombre "Tamaño", y Tabla repetía la región "Paginación". *Corrección:* los grupos de tokens ya no son regiones, la vista previa es un `div`, y las piezas de una sola variante no se repiten en una matriz.

**AUD-11 · Alto · Regiones con desplazamiento horizontal inalcanzables con teclado (27 elementos en 19 páginas, en celular).**
Tablas, matrices y escenarios con `overflow-x: auto` no podían recibir foco. *Corrección:* el script marca con `tabindex="0"` solo las que de verdad se desplazan, y se actualiza al cambiar el tamaño de la ventana; tienen anillo de foco visible.

**AUD-12 · Medio · El menú lateral cerrado en celular seguía recibiendo foco.**
*Evidencia:* con el menú cerrado, `link.focus()` lo enfocaba aunque estuviera fuera de pantalla. *Corrección:* cerrado queda `visibility: hidden`; Escape lo cierra y devuelve el foco al botón "Menú". Verificado en el navegador.

**AUD-13 · Medio · El botón de tema salía vacío en el HTML (31 páginas).**
El texto lo ponía JavaScript; sin él (o antes de cargar) era un botón sin nombre. *Corrección:* el HTML ya trae "Tema: sistema".

**AUD-14 · Bajo · El enlace "Saltar al contenido" no movía el foco.** `<main>` no era enfocable. *Corrección:* `tabindex="-1"`.

**AUD-15 · Medio · Los encabezados de las vistas previas se colaban en el esquema de la página.**
La página de Card tenía 13 `<h3>` de las vistas previas; la de Modal, 5 `<h2>`. Quien navega por encabezados se perdía. *Corrección:* en la documentación el título de esas piezas es un párrafo; el código mostrado sigue teniendo el encabezado real.

**AUD-16 · Medio · Cinco `aria-modal="true"` estáticos en la página de Modal.**
`aria-modal` le dice al lector de pantalla que el resto de la página no existe. *Corrección:* se quita solo de la vista previa; el código mostrado lo conserva.

**AUD-17 · Medio · Los 21 radios de la página de Radio compartían `name`.**
*Evidencia:* marcar uno desmarcaba el que estaba "marcado" de otra variante (1 marcado antes, 1 después, en vez de 2). *Corrección:* las vistas previas no llevan `name`; el código mostrado sí. Verificado: ahora 4 antes, 5 después.

**AUD-18 · Bajo · El estado indeterminado del Checkbox era solo visual.** La propiedad nativa `indeterminate` seguía en `false`. *Corrección:* el script la activa en la documentación (también tras cambiar la vista previa); la nota de accesibilidad explica que en uso real se hace por JavaScript.

**AUD-19 · Medio · Sin soporte para el modo de alto contraste forzado de Windows.**
Los bordes y anillos de foco se dibujan con `box-shadow`, que ese modo elimina: los controles quedaban sin borde. *Corrección:* `components/forced-colors.css` (incluido en `components.css`) añade contornos con colores del sistema. **No verificado visualmente** (ver alcance).

**AUD-20 · Bajo · HTML inválido.** 38 `<div>` dentro de `<span class="figure">` y 8 identificadores que empiezan por número (`02-anatomia`). *Corrección:* `div.figure` y prefijo `s-`.

**AUD-21 · Bajo · La documentación de Figma contradice al código en puntos concretos.**
La sección "Foco visible" de Button dice que no hay indicador de foco, y el código lo añade. *Corrección:* cada componente con diferencias muestra un aviso "Diferencias con Figma" (Button, Select, Modal, Tabla, Gráfica).

**AUD-22 · Bajo · Cada página pedía `/favicon.ico` (404).** *Corrección:* `<link rel="icon" href="data:,">`.

**AUD-23 · Bajo · La documentación de Button se desbordaba 41 px en celular.** Las tarjetas "Hacer / Evitar" no podían encogerse. *Corrección:* `min-width: 0`.

**AUD-24 · Bajo · Los fragmentos de código mostraban saltos de línea dentro de los textos** (`<p>\n Título\n</p>`), así que lo copiado no era el marcado real. *Corrección:* un elemento que solo contiene texto queda en una línea.

### Servidor MCP

**AUD-25 · Bajo · Una búsqueda parcial devolvía un componente cualquiera.** `get_component` con `a` devolvía `input`. *Corrección:* el nombre exacto gana; la búsqueda parcial exige 3 caracteres; si hay varias coincidencias, responde con la lista de candidatos.

**AUD-26 · Bajo · Los errores repetían la entrada completa.** Un nombre de 100 KB generaba una respuesta de 100 KB. *Corrección:* se recortan a 60 caracteres.

**AUD-27 · Bajo · `HEAD /health` respondía 404.** Muchos monitores usan HEAD. *Corrección:* `HEAD` en `/` y `/health`.

**AUD-28 · Bajo · Faltaban cabeceras de seguridad básicas.** *Corrección:* `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` y `Cache-Control: no-store` en `/health`.

*Lo que sí funcionaba bien:* 300 peticiones concurrentes en 0,2 s (p95 52 ms), rechazo correcto de JSON mal formado, tipos de contenido erróneos, herramientas inexistentes y cuerpos de más de 256 KB, y cierre limpio en 0,3 s con una conexión abierta.

### CI, Docker y repositorio

**AUD-29 · Medio · Las acciones de GitHub estaban tres versiones mayores atrás.** `checkout@v4` frente a v7, y GitHub avisa de que Node 20 está obsoleto. *Corrección:* `checkout@v7`, `setup-node@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`. **Riesgo:** `pages.yml` solo corre en `main`, así que no se puede probar antes del merge; si fallara, el sitio actual sigue publicado y se corrige después.

**AUD-30 · Bajo · `ci.yml` sin permisos mínimos ni tiempo límite.** *Corrección:* `permissions: contents: read` y `timeout-minutes: 15` en ambos flujos.

**AUD-31 · Bajo · `engines: ">=20"` era incorrecto.** `node --test` con patrones glob necesita Node 21 o superior, y el importador necesita 22.15. *Corrección:* `>=22` en ambos `package.json`.

**AUD-32 · Bajo · La descripción del paquete estaba desactualizada** ("Design tokens… exported from Figma").

**AUD-33 · Bajo · Dockerfile sin `HEALTHCHECK` y con la caché de capas desaprovechada.** Copiaba todo el repo antes de instalar dependencias. *Corrección:* instala primero (solo cambia con `mcp/package*.json`) y añade `HEALTHCHECK` contra `/health`. Imagen no construida (ver alcance).

**AUD-34 · Bajo · Sin linter; 5 defectos de calidad.** Importación sin usar (`existsSync`), función muerta (`hasInstance`), argumento sin usar, expresión regular con espacios ambiguos y un selector CSS `.stage` duplicado. *Corrección:* corregidos y `npm run lint` (ESLint + Stylelint) añadido al repo y a la integración continua.

**AUD-35 · Bajo · Las herramientas de lint añadieron una advertencia de `npm audit`** (`minimatch`, denegación de servicio, solo en desarrollo). *Corrección:* `overrides` a `minimatch ^11.0.4`; `npm audit` queda en 0 y el linter sigue funcionando.

---

## Hallazgos que no se corrigen

**AUD-36 · Medio · El repositorio es público y no tiene licencia.** Sin licencia, legalmente nadie puede reutilizar el código. Elegir una es una decisión tuya o de la empresa (MIT, Apache-2.0, propietaria…). *Pendiente de decisión.*

**AUD-37 · Medio · `main` no tiene protección y las ramas fusionadas siguen en GitHub.** Cualquiera con acceso de escritura puede subir directamente a `main`, y `feat/mvp-tokens-site-mcp` y `feat/site-sidebar-and-components` están fusionadas pero sin borrar (`delete_branch_on_merge` desactivado). Son ajustes del repositorio que no cambié sin tu permiso. *Recomendado:* exigir pull request y la verificación `CI` en `main`, y activar el borrado automático de ramas.

**AUD-38 · Informativo · El servidor MCP aún no está desplegado y falta la variable `MCP_URL`.** Pendiente de la cuenta de Railway.

**AUD-39 · Informativo (aceptado) · Roles ARIA sobre `div` en Tabla y Select Menu.** html-validate sugiere elementos nativos (`<table>`, `<select>`). La Tabla de Figma usa columnas de ancho fijo con separación y relleno que una `<table>` nativa no permite sin perder fidelidad, y Select Menu es una lista personalizada. Está documentado en las notas de accesibilidad de ambos componentes.

**AUD-40 · Informativo (aceptado) · El mensaje de error está dentro del `<label>`** en Input, Textarea, Select, Checkbox y Radio, así que el nombre accesible del campo incluye el error. Es un patrón simple que funciona sin generar identificadores; la alternativa correcta (`aria-describedby`) necesita ids únicos por instancia. Documentado en las notas de cada componente.

**AUD-41 · Informativo · Los fragmentos de código incrustan los íconos SVG completos**, lo que los hace largos y poco legibles. Son copiables y correctos; una versión resumida con un marcador sería una mejora de legibilidad, no un error.

**AUD-42 · Informativo · Cómo consumen las apps el sistema sigue sin resolverse.** `package.json` solo publica `tokens/`; los componentes y el CSS no se distribuyen como paquete. Está en el plan de trabajo.
