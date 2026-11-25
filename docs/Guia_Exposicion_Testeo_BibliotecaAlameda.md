# Guía de exposición y testeo - Biblioteca Alameda

## 1. Objetivo y reglas de tiempo

Preparar una exposición clara, comprobable y repartida entre los tres integrantes. La exposición del equipo dura **10 minutos exactos**; el minuto para el cambio entre equipos es aparte y no debe usarse para extender la presentación. Ensayen con cronómetro y dejen listas las pantallas antes de comenzar.

La docente también solicita:

- Iniciar con una pregunta detonadora.
- Presentar el branding del equipo, diseñado en Canva.
- Mostrar un fragmento de la entrevista y explicar sus conclusiones.
- Explicar y justificar el uso de IA y el tipo de base de datos NoSQL.
- Asegurar la participación de todos los integrantes.
- Asistir formalmente vestidos; todo el grupo debe asistir a la coevaluación y llevar bolígrafo.
- Llevar un dulce o paleta para cada compañero y compañera asistentes.

## 2. Integrantes

- Karla Natalia Jara Álvarez
- Francisco Javier Bustamante Miramontes
- Saúl Esparza Guevara

## 3. Branding y preparación de Canva

Diseñen en Canva una identidad sencilla y consistente para el equipo: nombre o logotipo, paleta de colores y estilo visual aplicados a todas las diapositivas. La guía de documentos del proyecto ya usa vino, marfil y dorado tenue como referencia visual; pueden mantener esa línea, pero el branding final lo define el equipo.

- Usen tipografías legibles y de buen tamaño; eviten fuentes decorativas en párrafos.
- Mantengan buen contraste entre texto y fondo, y poco texto por diapositiva.
- Si usan IA para crear recursos visuales o texto, revísenlos, corrijan errores y asegúrense de que sean legibles y adecuados. No presenten contenido generado sin verificarlo.
- Incluyan únicamente imágenes, datos y fragmentos de entrevista para los que tengan autorización.

## 4. Preparación antes de comenzar

Antes de la presentación:

1. Abrir [https://biblioteca-k76i.onrender.com](https://biblioteca-k76i.onrender.com).
2. Confirmar que `/api/mongo/status` muestra:
   - `connected: true`
   - `database: biblioteca_alameda`
3. Confirmar el usuario administrativo `Administrador`.
4. Tener abierta la página de GraphQL.
5. Tener disponible otra pestaña con MongoDB Atlas.
6. Tener una copia local en ejecución con `npm start`.
7. Mostrar la cuenta administrativa sin mostrar su contraseña.
8. Verificar una consulta por integrante.
9. Preparar capturas del CRUD y de las consultas.
10. Tener la presentación de Canva y el documento técnico disponibles.
11. Seleccionar y probar el fragmento de entrevista; dejarlo cargado en el punto exacto y tener una copia local.
12. Confirmar que el fragmento y las conclusiones caben en el tiempo asignado.
13. Llevar bolígrafo cada integrante y dulces o paletas para los asistentes.
14. Asistir con vestimenta formal.

## 5. Distribución de responsabilidades

### Karla Natalia Jara Álvarez

Presentación:

- Explicar el problema real de la Biblioteca.
- Presentar la decisión de usar MongoDB.
- Explicar el modelo de usuarios.
- Explicar el registro, aprobación y credencial digital.
- Demostrar la autenticación administrativa.

Consultas asignadas:

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

Demostración recomendada:

- Iniciar sesión.
- Crear o consultar un usuario.
- Aprobar una solicitud pendiente.
- Ejecutar `karlaUsersByStatus`.
- Explicar la diferencia entre usuarios aprobados y pendientes.

### Francisco Javier Bustamante Miramontes

Presentación:

- Explicar el flujo de préstamos.
- Relacionar préstamo, usuario y libro.
- Explicar fechas de préstamo y devolución.
- Explicar estados activos y devueltos.
- Demostrar actualizaciones y eliminación de préstamos.

Consultas asignadas:

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

Demostración recomendada:

- Crear un préstamo.
- Cambiar su estado a devuelto.
- Ejecutar `franciscoLoansByStatus`.
- Ejecutar `franciscoTopBorrowedBooks`.
- Explicar qué información administrativa obtiene la Biblioteca.

### Saúl Esparza Guevara

Presentación:

- Explicar arquitectura completa.
- Mostrar MongoDB Atlas y las tres colecciones.
- Demostrar GraphQL en el navegador.
- Explicar CRUD del catálogo.
- Demostrar despliegue en Render.

Consultas asignadas:

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

Demostración recomendada:

- Mostrar las colecciones en Atlas.
- Crear un libro temporal.
- Ejecutar `saulTopAuthors`.
- Editar y eliminar el libro temporal.
- Mostrar que el dato cambia en MongoDB.

## 6. Guion cronometrado de 10 minutos

Los tiempos son límites acumulados. Si el video no está listo para reproducirse al llegar su turno, salten al resumen de la entrevista; no gasten el tiempo buscando el archivo.

| Tiempo | Quién | Contenido |
|---|---|---|
| 0:00–0:35 | Karla | Pregunta detonadora y problema que aborda el proyecto. |
| 0:35–1:20 | Karla | Fragmento seleccionado de la entrevista (máximo 45 segundos). |
| 1:20–1:50 | Karla | Qué aprendieron de la entrevista y cómo influyó en la propuesta. |
| 1:50–2:40 | Saúl | Solución, arquitectura y recorrido breve por el branding del equipo. |
| 2:40–3:30 | Saúl | Por qué MongoDB: base documental NoSQL, documentos flexibles y agregaciones adecuadas para catálogo, usuarios y préstamos. |
| 3:30–4:20 | Francisco | Uso de IA: explicar en qué tareas concretas apoyó el equipo, qué verificaron y qué decisiones siguieron siendo del equipo. |
| 4:20–6:20 | Saúl | Demostración breve del catálogo, GraphQL y persistencia en MongoDB. |
| 6:20–7:05 | Karla | Demostración breve de usuarios y una consulta asignada. |
| 7:05–7:50 | Francisco | Demostración breve de préstamos y una consulta asignada. |
| 7:50–8:35 | Los tres | Cada integrante dice en unos 15 segundos un resultado o aprendizaje de su parte. |
| 8:35–9:35 | Karla y Francisco | Conclusiones de la entrevista, valor de la solución para la Biblioteca y limitaciones o mejoras futuras. |
| 9:35–10:00 | Los tres | Cierre y agradecimiento. |

El tiempo de 1 minuto para el cambio de equipo ocurre **después** de estos 10 minutos. Dejen de presentar al llegar a 10:00 para que el siguiente equipo pueda prepararse.

### Pregunta detonadora sugerida

> ¿Cómo puede una biblioteca administrar de forma más ordenada su catálogo, usuarios y préstamos, y obtener información útil para tomar decisiones?

Adáptenla a lo que la persona entrevistada realmente comentó; no atribuyan a la entrevista problemas o necesidades que no expresó.

### Explicación honesta del uso de IA

En este proyecto la IA se utilizó como apoyo durante el desarrollo —por ejemplo, para proponer y revisar cambios de código, ayudar a diagnosticar errores y preparar documentación—, no como una función generativa integrada que use el público. Expliquen solo las tareas que el equipo efectivamente realizó con IA y cómo verificaron cada resultado mediante revisión humana y pruebas. No digan que el sistema tiene recomendaciones inteligentes, chatbot u otra función de IA si no está implementada.

Guion sugerido:

> “Usamos IA como apoyo para acelerar algunas tareas de desarrollo y documentación. El equipo revisó y probó las propuestas, corrigió lo necesario y mantuvo la responsabilidad sobre las decisiones. La IA no sustituye la base de datos ni es una función que el usuario final utilice dentro de la aplicación.”

### Justificación de MongoDB

Descríbanla como **base de datos NoSQL documental**. Los registros de libros, usuarios y préstamos se almacenan como documentos; este modelo ofrece flexibilidad para sus campos y MongoDB permite ejecutar agregaciones para obtener estadísticas. Aclaren que las relaciones entre entidades se resuelven desde la aplicación y las consultas, no mediante tablas relacionales tradicionales.

## 7. Guion sugerido

### Apertura

Decir:

"Presentamos una solución para Biblioteca Alameda basada en MongoDB, Apollo GraphQL y JavaScript. El sistema permite administrar catálogo, usuarios, préstamos y consultas estadísticas."

### Introducción técnica

Explicar:

- MongoDB Atlas almacena los datos.
- Apollo Server expone GraphQL.
- El frontend usa `fetch()` para consumir el API.
- Render hospeda el backend y el frontend.
- Las sesiones autorizan operaciones administrativas.

### Demostración 1: MongoDB

Mostrar:

- La base `biblioteca_alameda`.
- Las colecciones `books`, `users`, `loans` y `accounts`.
- Un ejemplo de documento.
- El conteo de 1000 documentos por colección principal.

### Demostración 2: Catálogo

Mostrar:

- Consulta por título.
- Consulta por autor.
- Consulta por clasificador.
- Crear un libro.
- Editar un libro.
- Eliminar el libro temporal.

### Demostración 3: Usuarios

Mostrar:

- Crear usuario.
- Estado pendiente.
- Comprobante INE.
- Aprobar usuario.
- Generación de credencial.

### Demostración 4: Préstamos

Mostrar:

- Solicitud de préstamo.
- Fecha de préstamo.
- Fecha de retorno.
- Número de biblioteca.
- Cambio de estado.

### Demostración 5: Consultas complejas

Cada integrante ejecuta al menos una consulta propia y explica:

- Colecciones usadas.
- Pipeline o operaciones realizadas.
- Resultado obtenido.
- Uso administrativo del resultado.

### Cierre

Decir:

"El proyecto cumple el almacenamiento masivo, GraphQL, CRUD por integrante, consultas complejas, autenticación y despliegue público. La siguiente extensión sería integrar autenticación avanzada y el modelo formal según las necesidades de la Biblioteca."

## 8. Ejecución de testeo

### Parte 1: Estado del sistema

Verificar:

- Página pública disponible.
- Estado MongoDB conectado.
- Base `biblioteca_alameda`.
- Login administrativo.
- Logout administrativo.

### Parte 2: CRUD catálogo

Verificar:

- Crear libro.
- Consultar el libro creado.
- Editar un dato.
- Confirmar el cambio en Atlas.
- Eliminar el libro.

### Parte 3: CRUD usuarios

Verificar:

- Crear usuario.
- Validar comprobante INE.
- Ver usuario pendiente.
- Aprobar usuario.
- Verificar credencial.
- Actualizar o eliminar si corresponde.

### Parte 4: CRUD préstamos

Verificar:

- Crear solicitud.
- Completar fechas.
- Agregar número de biblioteca.
- Cambiar estado.
- Eliminar temporalmente si corresponde.

### Parte 5: Consultas

Verificar todas las consultas asignadas:

- Karla: 10 consultas.
- Francisco: 10 consultas.
- Saúl: 10 consultas.

Registrar:

- Nombre de la consulta.
- Tiempo aproximado.
- Resultado.
- Evidencia.

## 9. Consultas de ejemplo en Apollo Sandbox

### Ejemplo: usuarios por estado

```graphql
query {
  karlaUsersByStatus {
    label
    value
    count
  }
}
```

### Ejemplo: préstamos por estado

```graphql
query {
  franciscoLoansByStatus {
    label
    value
    count
  }
}
```

### Ejemplo: autores principales

```graphql
query {
  saulTopAuthors {
    label
    value
    count
  }
}
```

## 10. Plan de pruebas por integrante

### Karla

- Probar login.
- Probar usuario pendiente.
- Probar aprobación.
- Ejecutar diez consultas de usuarios.
- Explicar una consulta con resultado elevado.

### Francisco

- Probar creación de préstamo.
- Probar edición de estado.
- Ejecutar diez consultas de préstamos.
- Explicar relación con usuarios y libros.

### Saúl

- Probar CRUD de libros.
- Mostrar MongoDB Atlas.
- Ejecutar diez consultas del catálogo.
- Explicar conexión y despliegue.

## 11. Escenario de fallo

Si falla la red pública:

1. Mantener la calma.
2. Ejecutar `npm start` localmente.
3. Abrir `http://localhost:3000`.
4. Verificar que MongoDB esté conectado.
5. Ejecutar una consulta simple.
6. Continuar con la demostración local.
7. Informar que la publicación pública está disponible, pero usar Internet puede presentar latencia.

Si falla una mutation:

1. Verificar sesión administrativa.
2. Recargar `/api/auth/status`.
3. Iniciar sesión nuevamente.
4. Repetir la operación.
5. Usar una consulta no administrativa como respaldo.

Si falla MongoDB:

1. Mostrar el estado `/api/mongo/status`.
2. Confirmar la red y las variables.
3. Usar datos locales de demostración sólo si ya están preparados.
4. Explicar el riesgo sin ocultar la falla.

## 12. Evidencia que debe guardarse

- Captura del despliegue en Render.
- Captura de MongoDB conectado.
- Captura de 1000 documentos por colección.
- Captura del login administrativo.
- Captura de una creación, edición y eliminación.
- Capturas de al menos una consulta por integrante.
- Captura del testeo completo.
- Grabación o enlace de prueba si está disponible.
- Fragmento de entrevista utilizado y autorización correspondiente.
- Diapositivas con el branding del equipo.
- Conclusiones acordadas a partir de la entrevista.

## 13. Lista final antes de empezar

- [ ] Pregunta detonadora lista y ensayada.
- [ ] Presentación de Canva con branding consistente y texto legible.
- [ ] Exposición ensayada con cronómetro: máximo 10 minutos.
- [ ] Fragmento de entrevista probado y conclusiones preparadas.
- [ ] Explicación veraz del uso de IA y de MongoDB como NoSQL documental.
- [ ] Todos los integrantes tienen una participación y saben cuándo intervenir.
- [ ] Minuto de cambio considerado aparte de los 10 minutos.
- [ ] Todo el grupo asistirá a la coevaluación y llevará bolígrafo.
- [ ] Dulces o paletas preparados para las compañeras y compañeros asistentes.
- [ ] Vestimenta formal.
- [ ] Dominio público abierto.
- [ ] MongoDB conectado.
- [ ] Login probado.
- [ ] 1000 documentos visibles.
- [ ] Una mutation de cada pantalla probada.
- [ ] Diez consultas verificadas conceptualmente.
- [ ] Documento técnico disponible.
- [ ] Presentación abierta.
- [ ] Capturas disponibles.
- [ ] Servidor local preparado.
- [ ] Contraseña temporal cambiada.

## 14. Mensaje final

La presentación debe ser precisa y honesta: cada integrante explica su parte, demuestra una función y respeta el cronómetro. No afirmen que una capacidad existe si no pueden mostrarla funcionando.
