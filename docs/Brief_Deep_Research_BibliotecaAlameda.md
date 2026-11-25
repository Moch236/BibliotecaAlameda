# Brief de contenido para el documento de Deep Research

## Instrucciones para la IA que elaborará el DOCX

Usa este brief como contexto del proyecto Biblioteca Alameda. Genera un documento técnico comparativo, formal y verificable, listo para entregar en formato DOCX. El tema central es la selección entre MongoDB y Neo4j para la solución de la Biblioteca, explicando la arquitectura que efectivamente se implementó.

### Reglas de exactitud

1. Distingue los hechos confirmados del proyecto, las propuestas de análisis y los datos que el equipo todavía debe aportar.
2. No inventes resultados de investigación, entrevistas, citas, bibliografía, métricas, costos, volúmenes de uso, decisiones de la Biblioteca ni evidencia de pruebas.
3. Investiga y cita fuentes primarias y vigentes: documentación oficial de MongoDB, Neo4j, GraphQL, Apollo Server, Node.js y Express. Verifica cada URL y cada afirmación técnica. Si una fuente no puede comprobarse, no la incluyas.
4. Usa citas en el texto y bibliografía en un estilo consistente (se recomienda APA 7). Incluye autor u organización, título, fecha o “s. f.”, URL y fecha de consulta cuando corresponda.
5. No afirmes que la aplicación contiene un chatbot, recomendaciones con IA, predicción, clasificación automática u otra función de IA en tiempo de ejecución. La IA fue apoyo durante algunas tareas de desarrollo; no es una función del producto desplegado.
6. No incluyas contraseñas, URI de MongoDB, secretos, tokens, datos reales de usuarios ni capturas que los muestren. Utiliza datos sintéticos o anonimizados.
7. Conserva los marcadores `[POR COMPLETAR POR EL EQUIPO]` donde falten datos, y agrega al final una lista breve de esos pendientes.
8. La investigación debe analizar ventajas y limitaciones para este caso concreto, no presentar una tecnología como universalmente superior.

## 1. Datos del proyecto que se deben conservar

- **Nombre:** Biblioteca Alameda.
- **Contexto:** aplicación web académica para apoyar la administración y consulta del catálogo, el registro de usuarios, las credenciales y los préstamos de una biblioteca.
- **Equipo:** Karla Natalia Jara Álvarez, Francisco Javier Bustamante Miramontes y Saúl Esparza Guevara.
- **Stack implementado:** JavaScript, Node.js, Express, Apollo Server, GraphQL, MongoDB Atlas y Render.
- **Base de datos seleccionada:** MongoDB, una base NoSQL documental.
- **Controlador:** paquete oficial `mongodb` (MongoDB Node.js Driver); no describirlo como Mongoose.
- **API:** Apollo Server expone GraphQL mediante Express. Las operaciones de aplicación se envían a `POST /graphql`.
- **Frontend:** HTML, CSS y JavaScript del navegador; consume GraphQL mediante `fetch()`.
- **Despliegue público reportado:** `https://biblioteca-k76i.onrender.com`.
- **Base de datos configurada:** `biblioteca_alameda`.
- **Colecciones principales:** `books`, `users` y `loans`. La colección `accounts` guarda cuentas administrativas y hashes de contraseña.
- **Datos masivos:** el proyecto reportó 1000 documentos en cada una de las colecciones principales (`books`, `users`, `loans`). Verificar de nuevo el conteo en Atlas antes de incluirlo como estado actual y adjuntar una captura con fecha.
- **Visita:** el equipo reportó que presentó el sistema a la Biblioteca y recibió el visto bueno. Adjuntar evidencia real del visto bueno; no inventar fecha, cita o nombre de entrevistado.

## 2. Pregunta de investigación y objetivo

**Pregunta orientadora sugerida:**

> ¿Qué modelo de base de datos NoSQL se ajusta mejor a una aplicación académica para administrar catálogo, usuarios y préstamos de Biblioteca Alameda: MongoDB documental o Neo4j de grafos, considerando el modelo de datos, las operaciones CRUD, las consultas analíticas y la arquitectura GraphQL implementada?

**Objetivo:** comparar MongoDB y Neo4j con criterios relevantes para el proyecto, justificar la selección realizada y documentar cómo se integra la base escogida con el backend GraphQL, el frontend JavaScript y el despliegue.

No presentar esta pregunta como una pregunta textual de la entrevista. Es una formulación académica propuesta para el documento.

## 3. Necesidad y alcance funcional

La solución permite:

- Buscar libros por título, autor o clasificador.
- Crear, editar y eliminar registros del catálogo.
- Registrar usuarios con datos de solicitud y comprobante; revisar solicitudes pendientes y aprobar usuarios desde el flujo administrativo.
- Mostrar información de credencial digital.
- Registrar, consultar, actualizar y eliminar préstamos.
- Consultar estadísticas agregadas para apoyar tareas administrativas.
- Proteger las mutaciones administrativas mediante autenticación.

La entrevista y la visita son evidencia del contexto real. Completar la descripción de las necesidades con las observaciones que efectivamente expresó la Biblioteca:

- Necesidad o problema mencionado: `[POR COMPLETAR CON EVIDENCIA DE LA ENTREVISTA]`
- Observación de la visita: `[POR COMPLETAR]`
- Aprobación o retroalimentación recibida: `[POR COMPLETAR; ANEXAR EVIDENCIA]`

No atribuyas a la Biblioteca una necesidad si no está respaldada por la entrevista o la visita.

## 4. Comparación tecnológica requerida

Compara **MongoDB** (documental) y **Neo4j** (grafos) en el contexto de la carga de trabajo del proyecto. Explica cada criterio con fuentes citadas y un análisis propio:

1. **Representación de datos:** documentos y colecciones frente a nodos, relaciones y propiedades.
2. **Adecuación al catálogo:** libros con atributos descriptivos, ubicación, volumen y existencias.
3. **Adecuación a usuarios y préstamos:** información de personas, solicitudes, estado y referencias entre préstamos, usuarios y libros.
4. **Operaciones CRUD:** complejidad de implementar y mantener las operaciones que usa la aplicación.
5. **Consultas analíticas:** agregaciones y agrupaciones estadísticas frente a recorridos de relaciones y patrones de grafos.
6. **Relaciones y consultas de varios saltos:** explica cuándo Neo4j podría ofrecer una ventaja para preguntas centradas en redes de relaciones entre personas, libros, autores y préstamos. No afirmes que eso hace a Neo4j superior para todas las consultas.
7. **Flexibilidad del esquema:** evalúa cómo se adaptan los modelos a cambios en campos.
8. **Integración con JavaScript y GraphQL:** compara la compatibilidad técnica y el trabajo de integración, citando documentación oficial.
9. **Operación y despliegue:** considera Atlas y AuraDB únicamente con información de fuentes y fecha; no inventes precios ni disponibilidad.
10. **Aprendizaje, mantenimiento y alcance académico:** justifica según el equipo, las funcionalidades efectivamente desarrolladas y los requisitos de la asignatura.

### Matriz comparativa

Incluye una matriz con columnas como: criterio, MongoDB, Neo4j, relevancia para Biblioteca Alameda y evidencia/fuente. No asignes puntuaciones numéricas salvo que definas una metodología reproducible y el equipo realmente evalúe cada punto. Si se usa una valoración cualitativa (alta/media/baja), explica qué significa.

### Conclusión tecnológica que debe reflejarse

La elección implementada fue MongoDB. La justificación específica del proyecto debe relacionarla con:

- La representación documental de libros, usuarios y préstamos.
- El CRUD solicitado para esas entidades.
- El uso de MongoDB Aggregation Framework para las consultas estadísticas.
- La integración existente con Node.js y el driver oficial de MongoDB.
- La arquitectura GraphQL que concentra las operaciones de consulta y modificación.

También debe reconocer el escenario alternativo: Neo4j sería especialmente pertinente si el problema central exigiera explorar extensamente relaciones y recorridos de varios saltos. No afirmes que se desplegó Neo4j: el proyecto usa MongoDB Atlas.

## 5. Arquitectura implementada

Representa y explica esta secuencia:

```text
Navegador
  └─ HTML, CSS y JavaScript
       └─ fetch() → POST /graphql
            └─ Express 5 + integración Express de Apollo Server 5
                 └─ resolvers y lógica de aplicación
                      └─ MongoDB Node.js Driver 6
                           └─ MongoDB Atlas: biblioteca_alameda
```

Render hospeda el servicio web público reportado. Distingue claramente:

- GraphQL y Apollo Server son parte de la capa API/backend, no son la base de datos.
- JavaScript en navegador es la capa de interfaz.
- MongoDB es el motor de almacenamiento.
- MongoDB Atlas es el servicio administrado en la nube.
- Render es la plataforma de despliegue web.

Endpoints del proyecto:

- Aplicación: `https://biblioteca-k76i.onrender.com`
- GraphQL: `https://biblioteca-k76i.onrender.com/graphql`
- Salud: `https://biblioteca-k76i.onrender.com/health`
- Estado de MongoDB: `https://biblioteca-k76i.onrender.com/api/mongo/status`
- Estado de autenticación: `https://biblioteca-k76i.onrender.com/api/auth/status`

Los endpoints pueden cambiar o estar temporalmente inactivos; verificarlos antes de publicar el DOCX.

## 6. Modelo de datos descrito por el proyecto

### Colección `books`

Campos principales documentados: `id`, `title`, `author`, `classifier`, `total`, `volume`, `location` y `seed`.

### Colección `users`

Campos principales documentados: `id`, `libraryNumber`, `fullName`, `idDocument`, `address`, `postalCode`, `phone`, `email`, `occupation`, `workplace`, `addressProofType`, `addressProof`, `status`, `credentialNumber` y `seed`. La interfaz también contempla fotografía y contacto de emergencia.

Trata los datos personales como información sensible. Para el DOCX utiliza diagramas o documentos ficticios, no datos identificables.

### Colección `loans`

Campos principales documentados: `id`, `title`, `bookId`, `loanDate`, `returnDate`, `libraryNumber`, `borrowerName`, `status` y `seed`.

### Colección `accounts`

Guarda cuentas administrativas, rol, fecha de actualización y hash bcrypt de contraseña; no almacena la contraseña en texto plano según la implementación documentada.

Explica qué campos son principales, cómo se relacionan los préstamos con libros y usuarios y cuáles son las limitaciones del modelo actual. No presentes los campos como un esquema relacional rígido.

## 7. Backend, GraphQL y funcionalidades

El esquema GraphQL incluye consultas para libros, usuarios, solicitudes pendientes, préstamos, estados de MongoDB y autenticación. Incluye mutaciones de login/logout y operaciones para crear, aprobar, actualizar y eliminar usuarios; crear, actualizar y eliminar préstamos; y crear, actualizar y eliminar libros.

La interfaz presenta las secciones:

- **Catálogo:** buscar por título, autor o clasificador y administrar libros.
- **Usuarios:** registrar solicitudes, revisar pendientes, aprobar, administrar registros y consultar credencial.
- **Préstamos:** registrar y administrar solicitudes y estados de préstamo.
- **Consultas complejas:** acceder a las estadísticas asignadas a cada integrante.

## 8. Consultas complejas del proyecto

El esquema documenta 30 consultas, 10 por integrante. Todas se deben relacionar con una pregunta administrativa realista y describirse con: propósito, colecciones involucradas, etapas relevantes de agregación, campos de entrada (si aplica) y cómo interpretar el resultado.

### Karla Natalia Jara Álvarez — usuarios

1. `karlaUsersByStatus`
2. `karlaUsersByOccupation`
3. `karlaUsersByPostalCode`
4. `karlaPendingUsersByOccupation`
5. `karlaApprovedUsersByWorkplace`
6. `karlaDuplicateFullNames`
7. `karlaCredentialUsersByPostalCode`
8. `karlaUsersWithoutPhone`
9. `karlaUsersByPostalAndOccupation`
10. `karlaUsersWithLoansByStatus`

### Francisco Javier Bustamante Miramontes — préstamos

1. `franciscoLoansByStatus`
2. `franciscoLoansByMonth`
3. `franciscoTopBorrowedBooks`
4. `franciscoMostActiveBorrowers`
5. `franciscoOverdueActiveLoans`
6. `franciscoLoansByReturnMonth`
7. `franciscoAverageDurationByMonth`
8. `franciscoLoanStatusByBorrower`
9. `franciscoReturnedRateByMonth`
10. `franciscoTopLibraryNumbers`

### Saúl Esparza Guevara — catálogo

1. `saulTopAuthors`
2. `saulBooksByLocationPrefix`
3. `saulBooksByVolume`
4. `saulBooksByAvailability`
5. `saulBooksByClassifierRange`
6. `saulLocationsWithHighestStock`
7. `saulAuthorLocationMatrix`
8. `saulTopClassifiers`
9. `saulSubjectDistribution`
10. `saulAuthorsWithLowAvailability`

La presencia de una consulta en el esquema no demuestra que se haya ejecutado correctamente. Para presentar resultados actuales, ejecutar cada consulta en el entorno de prueba y guardar su evidencia. No inventar conteos ni tiempos de respuesta.

## 9. Seguridad, pruebas y límites

### Seguridad conocida

- Contraseñas administrativas guardadas como hash bcrypt.
- Mutaciones administrativas protegidas por autenticación.
- Tokens firmados con HMAC y expiración configurada por la aplicación; cookies marcadas `HttpOnly`, `SameSite=Lax` y, en producción, `Secure`.
- Variables privadas configuradas fuera del código, mediante entorno.

Menciona las medidas de forma proporcional. No describas el sistema como certificado o completamente seguro. Indica como límite que el frontend conserva el token para las solicitudes GraphQL y que cualquier evaluación de seguridad más amplia requiere pruebas específicas.

### Ejecución y pruebas

- Instalación: `npm install`
- Inicio: `npm start`
- Pruebas automatizadas: `npm test`
- Carga de datos de prueba: `npm run seed:mongo` (esta operación sustituye el contenido de colecciones principales; advertir que no se debe ejecutar contra datos reales o producción).

El proyecto reportó pruebas automatizadas para catálogo, autenticación/protección de operaciones y disponibilidad de las 30 consultas en el esquema. Antes de declarar el estado final, ejecutar nuevamente `npm test` y reportar la salida real. Aclarar que la prueba de presencia en el esquema no reemplaza ejecutar individualmente las 30 consultas.

### Limitaciones / trabajo futuro

Incluir solo límites comprobables o etiquetarlos como propuestas: pruebas de las 30 consultas contra datos vigentes, evidencia formal de calidad/rendimiento, validación de la información real con la Biblioteca, protección/gestión de documentos personales y mejoras futuras del modelo. No describas una propuesta como funcionalidad entregada.

## 10. Uso de IA en el proyecto

La IA se utilizó como apoyo en algunas tareas de desarrollo y documentación, como proponer o revisar cambios de código, ayudar a diagnosticar errores y estructurar documentos. El equipo conserva la responsabilidad sobre decisiones, revisión y pruebas. **No existe una función generativa integrada para los usuarios de la aplicación.**

Completar con ejemplos reales del equipo:

- Herramienta(s) utilizada(s): `[POR COMPLETAR]`
- Tarea(s) donde se utilizó: `[POR COMPLETAR CON EJEMPLOS REALES]`
- Cómo verificó el equipo las propuestas: `[POR COMPLETAR; incluir pruebas/revisión realizada]`
- Limitaciones o correcciones realizadas por el equipo: `[POR COMPLETAR]`

No atribuyas a IA la generación completa del sistema ni inventes prompts o resultados.

## 11. Evidencia y anexos que debe proporcionar el equipo

- Enlace al video de entrevista en YouTube: `[POR COMPLETAR]`
- Fecha y evidencia del visto bueno de la Biblioteca: `[POR COMPLETAR]`
- Hallazgos o conclusiones de entrevista, con evidencia: `[POR COMPLETAR]`
- Captura del conteo de `books`, `users` y `loans` en Atlas, con fecha: `[POR COMPLETAR]`
- Evidencia del despliegue y de la conexión a MongoDB: `[POR COMPLETAR/VERIFICAR]`
- Resultado reciente de `npm test`: `[POR COMPLETAR]`
- Registro de ejecución de las 30 consultas o, al menos, de las consultas demostradas: `[POR COMPLETAR]`
- Capturas del CRUD de catálogo, usuarios y préstamos, sin datos personales reales: `[POR COMPLETAR]`

## 12. Estructura recomendada del DOCX

1. Portada: título, integrantes, asignatura, docente, institución y fecha `[POR COMPLETAR]`.
2. Resumen ejecutivo y palabras clave.
3. Contexto, problema, justificación, alcance y objetivos.
4. Metodología de Deep Research, fecha de consulta y criterios de comparación.
5. Comparación MongoDB vs Neo4j con matriz y fuentes.
6. Decisión y justificación específica para Biblioteca Alameda.
7. Arquitectura técnica implementada.
8. Modelo de datos y colecciones.
9. API GraphQL y funcionalidades CRUD.
10. Consultas complejas por integrante y casos de uso.
11. Uso responsable de IA.
12. Seguridad, pruebas, resultados y límites.
13. Conclusiones y trabajo futuro.
14. Bibliografía y anexos de evidencia.

## Instrucción final de generación

El DOCX debe ser formal, legible, coherente, con diagramas originales de arquitectura y modelo de datos. Incluye las citas dentro del texto y una bibliografía verificable. Evita páginas saturadas, tablas ilegibles y conclusiones sin evidencia. No sustituyas los marcadores pendientes con información inventada. Añade una sección final “Datos que el equipo debe completar antes de entregar”.

### Archivos del repositorio que sirven como contexto

- `README.md`
- `docs/Documento_Tecnico_BibliotecaAlameda.md`
- `docs/Guia_Exposicion_Testeo_BibliotecaAlameda.md`
- `server.js`
- `app.js`
- `index.html`
- `test/server.test.js`
- `scripts/seed-mongo.js`

El código y la evidencia actual prevalecen sobre descripciones antiguas si hubiera discrepancias.
