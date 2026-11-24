# Guía de exposición y testeo - Biblioteca Alameda

## 1. Objetivo

Esta guía explica qué debe decir y demostrar cada integrante durante la exposición y el testeo. El equipo debe ensayar una presentación entre 12 y 15 minutos y conservar una ruta local alternativa por si falla Internet.

## 2. Integrantes

- Karla Natalia Jara Álvarez
- Francisco Javier Bustamante Miramontes
- Saúl Esparza Guevara

## 3. Preparación antes de comenzar

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
10. Tener el documento técnico y el PDF disponibles.

## 4. Distribución de responsabilidades

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

## 5. Guion sugerido

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

## 6. Ejecución de testeo

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

## 7. Consultas de ejemplo en Apollo Sandbox

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

## 8. Plan de pruebas por integrante

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

## 9. Escenario de fallo

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

## 10. Evidencia que debe guardarse

- Captura del despliegue en Render.
- Captura de MongoDB conectado.
- Captura de 1000 documentos por colección.
- Captura del login administrativo.
- Captura de una creación, edición y eliminación.
- Capturas de al menos una consulta por integrante.
- Captura del testeo completo.
- Grabación o enlace de prueba si está disponible.

## 11. Lista final antes de empezar

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

## 12. Mensaje final

La presentación debe evitar improvisar detalles técnicos. Cada integrante explica una parte específica, demuestra su consulta asignada y entrega el turno al siguiente integrante.
