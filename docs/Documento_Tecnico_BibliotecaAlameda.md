# Documento técnico - Biblioteca Alameda

## 1. Identificación del proyecto

- Proyecto: Biblioteca Alameda
- Integrantes:
  - Karla Natalia Jara Álvarez
  - Francisco Javier Bustamante Miramontes
  - Saúl Esparza Guevara
- Tecnologías:
  - JavaScript
  - Node.js
  - Express
  - Apollo Server
  - GraphQL
  - MongoDB Atlas
  - Render

## 2. Comparación tecnológica

### MongoDB

MongoDB es una base de datos documental adecuada para usuarios, libros y préstamos porque permite representar documentos independientes y evolucionar el modelo sin migraciones rígidas.

Ventajas consideradas:

- Inserción y consulta flexible de documentos.
- Aggregation Framework para consultas estadísticas.
- Persistencia en MongoDB Atlas.
- Buen ajuste para CRUD con JavaScript.
- Menor complejidad de infraestructura para el alcance del proyecto.

### Neo4j

Neo4j es una base de datos de grafos adecuada para relaciones complejas entre lectores, libros, préstamos y autores.

Ventajas consideradas:

- Consultas nativas de relaciones.
- Recorridos por relaciones lectores-libros-préstamos.
- Modelo visual de grafos.

### Decisión

Se seleccionó MongoDB junto con Apollo Server y GraphQL porque el proyecto requiere persistencia documental, un API único, datos masivos y agregaciones estadísticas. MongoDB Atlas cubre el almacenamiento en la nube y permite un despliegue sencillo con Node.js.

## 3. Arquitectura

```text
Navegador
  |
  | HTML / CSS / JavaScript
  v
Servidor Node.js + Express
  |
  | POST /graphql
  v
Apollo Server
  |
  | MongoDB Driver
  v
MongoDB Atlas
  |
  +-- biblioteca_alameda.books
  +-- biblioteca_alameda.users
  +-- biblioteca_alameda.loans
  +-- biblioteca_alameda.accounts
  +-- biblioteca_alameda.userDocuments.files / userDocuments.chunks (GridFS)
```

Componentes principales:

- `server.js`: servidor Express, sesiones, Apollo Server y conexión Atlas.
- `app.js`: interfaz y comunicación con GraphQL.
- `index.html`: estructura de las pantallas.
- `styles.css`: presentación responsiva.
- `scripts/seed-mongo.js`: generación e inserción masiva.
- `scripts/create-admin.js`: creación cifrada del administrador.
- `test/server.test.js`: pruebas automatizadas.

## 4. Modelo de datos

### Colección `books`

Campos principales:

- `id`
- `title`
- `author`
- `classifier`
- `total`
- `volume`
- `location`
- `seed`

### Colección `users`

Campos principales:

- `id`
- `libraryNumber`
- `fullName`
- `idDocument`
- `address`
- `postalCode`
- `phone`
- `email`
- `occupation`
- `workplace`
- `addressProofType`
- `addressProof`
- `photo`
- `addressProofFileId` (referencia privada a GridFS)
- `photoFileId` (referencia privada a GridFS, opcional)
- `status`
- `credentialNumber`
- `seed`

### Colección `loans`

Campos principales:

- `id`
- `title`
- `bookId`
- `loanDate`
- `returnDate`
- `libraryNumber`
- `borrowerName`
- `status`
- `seed`

### Colección `accounts`

Campos principales:

- `username`
- `passwordHash`
- `role`
- `updatedAt`

La contraseña administrativa no se almacena en texto plano. Se usa bcrypt para guardar únicamente el hash.

### Archivos de usuario en GridFS

Las solicitudes nuevas cargan el contenido del comprobante y, opcionalmente, una fotografía. El servidor acepta comprobantes PDF/JPG/PNG y fotografías JPG/PNG, con un máximo de 5 MB por archivo. Valida extensión, MIME y firma inicial, y almacena los documentos en el bucket `userDocuments`; las referencias se guardan en el usuario y no se exponen en la API GraphQL. Los endpoints de carga y descarga requieren una sesión administrativa. Al eliminar al usuario, también se eliminan sus documentos GridFS. Los registros creados antes de esta función pueden conservar solo nombres de archivo y no contienen un documento recuperable.

## 5. Datos masivos

La aplicación contiene 1000 documentos en cada colección principal:

- `books`: 1000
- `users`: 1000
- `loans`: 1000

Para volver a cargar los datos en MongoDB Atlas:

```bash
npm install
npm run seed:mongo
```

La carga elimina el contenido previo de `books`, `users` y `loans` y debe ejecutarse sólo en el entorno preparado para datos de prueba.

## 6. Ejecución local

### Requisitos

- Node.js 22 o compatible.
- Cuenta de MongoDB Atlas.
- Acceso de red habilitado para el equipo.
- Usuario y contraseña de MongoDB.

### Configuración

Crear un archivo `.env` en la raíz del proyecto:

```env
MONGODB_DATABASE="biblioteca_alameda"
MONGODB_URI="<URI privada de MongoDB Atlas>"
SESSION_SECRET="<clave aleatoria privada>"
```

No subir `.env` ni compartir sus valores.

### Instalación y arranque

```bash
npm install
npm start
```

Abrir:

```text
http://localhost:3000
```

La raíz redirige a `/login` si no existe una sesión administrativa válida. La sesión se conserva en una cookie `HttpOnly`, no en `localStorage`. La consulta GraphQL del catálogo de libros puede hacerse sin iniciar sesión; la interfaz administrativa, usuarios, préstamos, estadísticas y operaciones administrativas requieren autenticación.

Endpoints principales:

- Inicio de sesión: `http://localhost:3000/login`
- Aplicación administrativa: `http://localhost:3000` (requiere sesión)
- GraphQL: `http://localhost:3000/graphql`
- Estado MongoDB: `http://localhost:3000/api/mongo/status`
- Salud: `http://localhost:3000/health`
- Estado de autenticación: `http://localhost:3000/api/auth/status`

## 7. Pruebas

Ejecutar:

```bash
npm test
```

Las pruebas verifican:

- Catálogo por GraphQL.
- Redirección al login y protección de lecturas privadas y operaciones administrativas.
- Acceso autenticado con cookie y cierre de sesión.
- Rechazo de rutas REST obsoletas.
- Exposición exacta de 30 consultas complejas.

## 8. Autenticación

El acceso administrativo se crea con:

```bash
npm run admin:create
```

El comando requiere:

```env
ADMIN_USERNAME="<usuario>"
ADMIN_PASSWORD="<contraseña temporal>"
```

Para producción, cambie la contraseña temporal después de la primera sesión. La contraseña no se guarda en texto plano.

La aplicación tiene una pantalla de login independiente en `/login`. El backend verifica la contraseña con bcrypt y entrega una cookie firmada, `HttpOnly`, `SameSite=Lax` y `Secure` en producción. Las rutas administrativas y lecturas privadas de GraphQL requieren esa sesión; el catálogo de libros permanece público. El cierre de sesión elimina la cookie y vuelve al login.

## 9. GraphQL

Todas las operaciones principales se realizan con `POST /graphql`.

Ejemplo de consulta:

```graphql
query {
  books(field: "title", query: "Biblioteca") {
    id
    title
    author
  }
}
```

Ejemplo de mutation protegida:

```graphql
mutation {
  createBook(
    input: {
      title: "Libro de prueba"
      author: "Equipo"
      classifier: "000 TEST"
      total: 1
      volume: "I"
      location: "A-01"
    }
  ) {
    id
    title
  }
}
```

## 10. Consultas complejas

### Karla Natalia Jara Álvarez

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

### Francisco Javier Bustamante Miramontes

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

### Saúl Esparza Guevara

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

Todas las consultas usan agregaciones MongoDB y regresan nombre, valor, conteo y detalle adicional cuando aplica.

## 11. Demostración en Apollo Sandbox

1. Abrir `POST /graphql`.
2. Ejecutar una consulta simple.
3. Iniciar sesión en la interfaz.
4. Ejecutar una mutation CRUD.
5. Ejecutar una consulta compleja de cada integrante.
6. Verificar que los documentos se modifican en Atlas.

## 12. Despliegue

URL pública:

```text
https://biblioteca-k76i.onrender.com
```

Configuración Render:

- Build Command: `npm install`
- Start Command: `npm start`
- Branch: `main`
- Variables:
  - `MONGODB_URI`
  - `MONGODB_DATABASE=biblioteca_alameda`
  - `SESSION_SECRET`

No guardar la URI ni el secreto dentro del repositorio.

## 13. Evidencia de verificación

Verificar:

```text
https://biblioteca-k76i.onrender.com/api/mongo/status
https://biblioteca-k76i.onrender.com/health
https://biblioteca-k76i.onrender.com/graphql
```

El estado MongoDB debe indicar que está conectado y que la base es `biblioteca_alameda`.

## 14. Seguridad

Acciones obligatorias antes de la exposición final:

1. Rotar la contraseña de MongoDB que fue compartida durante el desarrollo.
2. Cambiar la contraseña temporal `admin`.
3. Configurar `SESSION_SECRET` aleatorio en Render.
4. Mantener `.env` fuera del repositorio.
5. Revisar permisos de MongoDB Atlas.
6. Evitar publicar capturas que muestran secretos.

## 15. Pendientes externos

- Adjuntar evidencia de visita a la Biblioteca.
- Adjuntar URL del video de la entrevista en YouTube.
- Añadir Vo.Bo. recibido.
- Completar bibliografía y evidencia de Deep Research.
- Preparar diapositivas de exposición.
