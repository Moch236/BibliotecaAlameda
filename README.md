# BibliotecaAlameda
Repositorio de aplicación tester para la biblioteca situada en el parque Alameda en Tepic

## Ejecutar la aplicación

```bash
npm install
npm start
```

Abra `http://localhost:3000`. La aplicación incluye acceso por usuario, consulta de libros por título, autor o clasificador, registro de usuarios y credenciales digitales, solicitudes de préstamo y conexión a MongoDB Atlas.

## Despliegue en Render

Configure el servicio con `npm install` como build y `npm start` como inicio.
Defina estas variables de entorno en Render:

```env
MONGODB_URI=<URI de MongoDB Atlas>
MONGODB_DATABASE=biblioteca_alameda
PORT=3000
```

El endpoint de salud es `/health` y el estado MongoDB puede consultarse en `/api/mongo/status`.

## Seguridad y administración

Las mutaciones CRUD requieren una sesión iniciada como administrador. Defina también `SESSION_SECRET` en el entorno de despliegue.

Para crear o actualizar el primer administrador:

```bash
set ADMIN_USERNAME=Administrador
set ADMIN_PASSWORD=<contraseña temporal>
npm run admin:create
```

No almacene contraseñas administrativas en texto plano ni en Git. La aplicación guarda únicamente su hash bcrypt en MongoDB.

Antes de iniciar, configure en `.env` la cadena real de MongoDB Atlas:

```env
MONGODB_URI="mongodb+srv://usuario:<password>@cluster.mongodb.net/"
MONGODB_DATABASE="biblioteca_alameda"
```

El estado de la conexión puede consultarse en `http://localhost:3000/api/mongo/status`.

Para ejecutar las pruebas:

```bash
npm test
```

## Consultas supercomplejas GraphQL

La API expone 30 consultas de agregación MongoDB, distribuidas en 10 por integrante:

### Karla Natalia Jara Álvarez - Usuarios

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

### Francisco Javier Bustamante Miramontes - Préstamos

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

### Saúl Esparza Guevara - Catálogo

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
