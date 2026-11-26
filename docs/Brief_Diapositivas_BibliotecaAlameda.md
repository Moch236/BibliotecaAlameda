# Brief para generar la presentación de Biblioteca Alameda

## Instrucciones para la IA que elaborará el PPTX

Genera una presentación formal, visual, clara y editable para una exposición académica de **10 minutos exactos** sobre el proyecto Biblioteca Alameda. La presentación debe explicar el proyecto real, mostrar un fragmento de entrevista, justificar la base NoSQL y el uso de IA, y dar participación a los tres integrantes.

El minuto para el cambio entre equipos es aparte: **no lo incluyas dentro de los 10 minutos**. El PDF original menciona exposición el 25 de noviembre y testeo el 26 de noviembre; confirmar el horario asignado por la docente antes de poner la fecha en portada.

## Reglas para no inventar información

- Utiliza únicamente datos incluidos aquí, en los archivos del repositorio o en evidencia proporcionada por el equipo.
- No inventes comentarios de la entrevista, necesidades de la Biblioteca, resultados de consultas, cifras de uso, tiempos de rendimiento, costos, puntuaciones comparativas ni resultados de testeo.
- Deja `[POR COMPLETAR POR EL EQUIPO]` en enlaces, fecha, docente, institución o evidencias faltantes.
- No presentes a Neo4j como tecnología implementada: el sistema utiliza MongoDB.
- No digas que la aplicación tiene un chatbot, IA generativa, recomendaciones inteligentes o predicciones. La IA fue apoyo durante algunas tareas de desarrollo, no una función para el usuario final.
- No muestres `.env`, contraseñas, URI de MongoDB, tokens, datos personales ni documentos de usuarios. Utiliza capturas ficticias o anonimizadas.
- Si se utiliza IA para generar imágenes o texto visual, revisar exactitud, ortografía, legibilidad y derechos de uso.

## Identidad visual y formato

- **Tema:** Biblioteca Alameda, tecnología y servicio comunitario.
- **Branding del equipo:** crear en Canva un nombre/identidad propia, logotipo o marca y aplicarla coherentemente a portada, separadores y cierre. El monograma “BA” existente en la interfaz puede servir de referencia, pero no afirmar que es el branding creado en Canva.
- **Paleta sugerida:** vino/burdeos, marfil y dorado tenue, inspirada en los documentos del proyecto. Mantener alto contraste.
- **Tipografía:** usar una familia legible; títulos claros y texto suficientemente grande para el salón. Evitar texto largo, fuentes decorativas en párrafos y fondos con bajo contraste.
- **Composición:** una idea central por diapositiva, pocas viñetas, diagramas simples y capturas reales recortadas para que se lean.
- **Accesibilidad:** no depender solo del color para comunicar estados; usar etiquetas, iconos con texto alternativo cuando sea posible y buen contraste.
- **Referencias:** incluir fuentes breves al pie en las diapositivas técnicas y una diapositiva final de referencias/anexos, que puede quedar fuera del tiempo oral.

## Contexto técnico confirmado

- Proyecto web académico para gestión de catálogo, usuarios, credenciales y préstamos de una biblioteca.
- Interfaz HTML/CSS/JavaScript con secciones: Catálogo, Usuarios, Préstamos y Consultas complejas.
- Backend Node.js con Express y Apollo Server.
- API GraphQL en `POST /graphql`, consumida desde el frontend con `fetch()`.
- Persistencia en MongoDB Atlas, base `biblioteca_alameda`, mediante el driver oficial `mongodb`.
- Despliegue público reportado: `https://biblioteca-k76i.onrender.com` (verificar que esté activo antes de la exposición).
- Colecciones principales: `books`, `users`, `loans`; también existe `accounts` para autenticación administrativa.
- Proyecto reporta 1000 documentos en cada colección principal. Mostrar conteos solo después de comprobarlos en Atlas y llevar una captura fechada.
- Autenticación administrativa: hash bcrypt y token firmado en cookie `HttpOnly`; la aplicación, las lecturas privadas y las operaciones administrativas requieren sesión. El catálogo de libros es público y el navegador no guarda el token en `localStorage`.
- Préstamos: el servidor verifica que el título exista en el catálogo, haya ejemplares disponibles y el número corresponda a un usuario aprobado. Las estadísticas de disponibilidad cuentan stock restante; las categorías se infieren del título y la duración mensual es programada, no real.
- Consultas complejas documentadas: 30 en total, 10 de usuarios, 10 de préstamos y 10 de catálogo.
- Las consultas son funciones GraphQL que ejecutan agregaciones en MongoDB; no presentar resultados concretos si no se han ejecutado y verificado.

## Guion de 10 minutos y contenido diapositiva por diapositiva

Los minutos son acumulados. El PPTX puede usar 10 u 11 diapositivas principales; no añadir contenido que haga imposible respetar los tiempos. El clip de entrevista dura máximo 45 segundos y debe probarse con anticipación.

### 1. Apertura: pregunta detonadora — 0:00 a 0:35

**Presenta:** Karla.

**Pregunta sugerida:**

> ¿Cómo puede una biblioteca administrar de forma más ordenada su catálogo, usuarios y préstamos, y obtener información útil para tomar decisiones?

**Contenido visual:** título Biblioteca Alameda, marca Canva del equipo y una imagen propia o autorizada relacionada con biblioteca.

**Notas para quien expone:** hacer la pregunta, dar una pausa breve y conectar con el propósito de la solución. No responder atribuyendo problemas a la Biblioteca que no aparezcan en la entrevista.

### 2. Entrevista — 0:35 a 1:20

**Presenta:** Karla; reproducir un clip de hasta 45 segundos.

**Contenido visual:** clip o fotograma autorizado, nombre/cargo solo con permiso y subtítulos revisados.

**Pendiente:** enlace YouTube `[POR COMPLETAR]`, marca de tiempo inicial/final `[POR COMPLETAR]`, confirmar permiso de uso.

**Plan de respaldo:** tener el clip descargado o insertar una cita fiel con autorización. No utilizar una cita inventada o alterada.

### 3. Hallazgos de entrevista — 1:20 a 1:50

**Presenta:** Karla.

**Contenido:** dos o tres ideas que la entrevista realmente confirmó y cómo influyeron en el alcance del sistema.

**Pendiente:** `[AÑADIR HALLAZGOS REALES Y SU EVIDENCIA]`.

### 4. Solución y equipo — 1:50 a 2:40

**Presenta:** Saúl.

**Contenido:** branding creado en Canva; propósito de la aplicación; mapa breve de los módulos Catálogo, Usuarios, Préstamos y Consultas complejas.

**Visual:** diagrama de módulos o capturas de la interfaz, sin datos sensibles.

### 5. Arquitectura y elección NoSQL — 2:40 a 3:30

**Presenta:** Saúl.

**Diagrama recomendado:**

```text
Navegador (HTML/CSS/JavaScript)
  → fetch() / POST /graphql
  → Express + Apollo Server / GraphQL
  → MongoDB Driver
  → MongoDB Atlas (biblioteca_alameda)
Render aloja el servicio web
```

**Justificación:** MongoDB es NoSQL documental. El modelo documental se ajusta a los registros de libros, usuarios y préstamos; sus agregaciones permiten calcular estadísticas. Neo4j sería una alternativa especialmente interesante para recorridos intensivos de relaciones, pero no es la base seleccionada ni implementada.

**No confundir:** GraphQL/Apollo son la API; MongoDB es la base de datos; Render es el hosting.

### 6. Uso de IA — 3:30 a 4:20

**Presenta:** Francisco.

**Mensaje que deben adaptar a lo que realmente hicieron:**

> “Usamos IA como apoyo para algunas tareas de desarrollo y documentación, como proponer o revisar cambios y ayudar a diagnosticar errores. El equipo revisó y probó las propuestas, corrigió lo necesario y mantuvo la responsabilidad sobre las decisiones. La IA no es una función generativa que use el público dentro de la aplicación.”

**Agregar:** herramienta(s) efectivamente usada(s), ejemplos concretos y forma de validación `[COMPLETAR POR EL EQUIPO]`.

**Visual:** flujo simple “apoyo de IA → revisión del equipo → pruebas”, sin exponer conversaciones privadas, secretos o información personal.

### 7. Demostración principal — 4:20 a 6:20

**Presenta:** Saúl.

**Demostrar con sistema activo:**

1. Estado de servicio y conexión con MongoDB, sin revelar variables o credenciales.
2. Búsqueda en catálogo por título, autor o clasificador.
3. Crear, editar y eliminar un registro de prueba, si la autenticación y el entorno permiten hacerlo de forma segura.
4. Mostrar en Atlas que el cambio persistió.

**Visual:** captura o grabación de respaldo preparada. No ejecutar el script de carga masiva ni alterar datos reales durante la exposición.

**Endpoint de estado:** `https://biblioteca-k76i.onrender.com/api/mongo/status` (verificar antes).

### 8. Usuarios y préstamos — 6:20 a 7:50

**Presentan:** Karla (6:20–7:05) y Francisco (7:05–7:50).

**Karla:** explicar solicitud de usuario, revisión/aprobación administrativa y credencial digital; ejecutar una operación o mostrar evidencia sin revelar datos personales.

**Francisco:** explicar solicitud de préstamo, fechas y estado; demostrar una consulta o cambio de estado con un registro de prueba.

**Visual:** capturas anonimizadas, flujo de usuario y flujo de préstamo.

### 9. Consultas y resultado — 7:50 a 8:35

**Presentan:** los tres; aproximadamente 15 segundos cada uno.

Cada integrante dice la pregunta administrativa que responde una consulta propia y muestra el resultado solo si lo verificó:

- Karla: `karlaUsersByStatus` — usuarios agrupados por estado.
- Francisco: `franciscoLoansByStatus` — préstamos agrupados por estado.
- Saúl: `saulTopAuthors` — autores principales según el agregado implementado.

**Advertencia:** estos ejemplos identifican la consulta a ejecutar, no garantizan un resultado o conteo específico. Preparar previamente capturas verificadas para evitar depender de la red.

### 10. Conclusiones — 8:35 a 9:35

**Presentan:** Karla y Francisco.

Incluir:

- Qué necesidad del proyecto y de la entrevista atendieron (solo hallazgos corroborados).
- Qué aporta la solución y qué demostraron.
- Por qué MongoDB encaja con el alcance actual.
- Límites y mejoras futuras, claramente identificados como futuras y no como funciones ya entregadas.

### 11. Cierre — 9:35 a 10:00

**Presentan:** los tres.

Una frase final breve de agradecimiento. Terminar al llegar a 10:00.

## Protocolo para la demostración y testeo

### Antes del evento

- Verificar que la URL pública responda y que MongoDB aparezca conectado.
- Probar login/logout y mutaciones administrativas.
- Probar previamente los flujos de libros, usuarios y préstamos.
- Ejecutar `npm test` y conservar la salida real, con fecha.
- Probar las consultas complejas que se mostrarán. Si mencionan que las 30 fueron testeadas, conservar evidencia de ejecución de las 30.
- Preparar pestañas, navegador, cuenta autorizada, capturas y clip de entrevista antes de empezar.
- Tener respaldo local preparado; no cargar ni sobrescribir datos reales con el script de seed.
- Proteger datos personales y secretos en ventanas, capturas y grabaciones.

### En testeo

- Probar cada sección CRUD: catálogo, usuarios y préstamos.
- Comprobar persistencia en MongoDB Atlas.
- Probar la autenticación y confirmar que las mutaciones protegidas no se permitan sin autorización.
- Registrar los resultados observados; no editar capturas para ocultar fallos.
- La fecha indicada en el PDF para testeo es el 26 de noviembre; confirmar el horario final con la docente.

## Evidencia requerida o recomendada

- Fragmento de entrevista y URL de YouTube; permiso de reproducción.
- Evidencia de visita y Vo. Bo. de la Biblioteca.
- Conteos actuales de 1000 documentos por colección principal en Atlas.
- Capturas de CRUD, login y conexión, con datos ficticios/anónimos.
- Pruebas automatizadas recientes.
- Resultados reales de las consultas presentadas.
- Bibliografía de MongoDB, Neo4j, GraphQL/Apollo y arquitectura usada, citada en las diapositivas o en una diapositiva de referencias.
- Registro de herramientas y usos reales de IA.

## Preparación física y reglas de la docente

- Exposición formalmente vestidos.
- Todo el equipo asiste a la coevaluación y lleva bolígrafo.
- Llevar un dulce o paleta para cada compañera y compañero asistente.
- Ensayar con cronómetro hasta lograr 10 minutos o menos.
- Dejar 1 minuto para el cambio entre equipos, fuera de los 10 minutos.
- Definir quién controla diapositivas, clip, navegador, cronómetro y material de respaldo.

## Instrucción final de generación

Genera un PPTX editable, con notas del presentador que contengan el texto oral conciso de cada integrante y su tiempo. Mantén un ritmo realista, alto contraste y tipografía legible; no satures las diapositivas. Pon las referencias breves en el pie o en una diapositiva final de respaldo. No agregues cifras, citas ni imágenes que no estén verificadas. Conserva marcadores `[POR COMPLETAR]` para los pendientes.

### Archivos del repositorio que sirven como contexto

- `README.md`
- `docs/Documento_Tecnico_BibliotecaAlameda.md`
- `docs/Guia_Exposicion_Testeo_BibliotecaAlameda.md`
- `docs/Brief_Deep_Research_BibliotecaAlameda.md`
- `server.js`
- `app.js`
- `index.html`
- `test/server.test.js`

Ante una contradicción, prevalecen el código actual y la evidencia reciente sobre afirmaciones antiguas.
