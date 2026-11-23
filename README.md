# BibliotecaAlameda
Repositorio de aplicación tester para la biblioteca situada en el parque Alameda en Tepic

## Ejecutar la aplicación

```bash
npm install
npm start
```

Abra `http://localhost:3000`. La aplicación incluye acceso por usuario, consulta de libros por título, autor o clasificador, registro de usuarios y credenciales digitales, solicitudes de préstamo y conexión a MongoDB Atlas.

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
