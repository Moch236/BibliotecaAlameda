const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const catalog = [
  { id: "1", title: "Cien años de soledad", author: "Gabriel García Márquez", classifier: "863 G163c", total: 4, volume: "Edición conmemorativa", location: "Estantería A-12" },
  { id: "2", title: "Pedro Páramo", author: "Juan Rulfo", classifier: "863 R936p", total: 3, volume: "Volumen único", location: "Estantería B-04" },
  { id: "3", title: "El laberinto de la soledad", author: "Octavio Paz", classifier: "972 P348l", total: 2, volume: "Tomo I", location: "Estantería C-07" }
];
const users = [];
const loans = [];
let mongoClient = null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error("Solicitud demasiado grande"));
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("JSON inválido")); }
    });
  });
}

async function connectMongo(uri, databaseName) {
  if (!uri) throw new Error("Se requiere la cadena de conexión de MongoDB Atlas");
  const { MongoClient } = require("mongodb");
  if (mongoClient) await mongoClient.close();
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  return mongoClient.db(databaseName || "biblioteca_alameda");
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/catalog") {
    const field = url.searchParams.get("field");
    const query = (url.searchParams.get("query") || "").trim().toLowerCase();
    const results = query
      ? catalog.filter(book => {
          const value = field === "title" ? book.title
            : field === "author" ? book.author
            : field === "classifier" ? book.classifier
            : `${book.title} ${book.author} ${book.classifier}`;
          return value.toLowerCase().includes(query);
        })
      : catalog;
    return sendJson(res, 200, results);
  }

  if (req.method === "POST" && url.pathname === "/api/users") {
    try {
      const body = await readJson(req);
      if (!body.fullName || !body.idDocument || !body.address) {
        return sendJson(res, 400, { error: "El nombre completo, documento y domicilio son obligatorios" });
      }
      const user = { id: crypto.randomUUID(), ...body, credentialNumber: `BA-${Date.now().toString().slice(-8)}` };
      users.push(user);
      return sendJson(res, 201, user);
    } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }

  if (req.method === "POST" && url.pathname === "/api/loans") {
    try {
      const body = await readJson(req);
      if (!body.title || !body.loanDate || !body.returnDate || !body.libraryNumber) {
        return sendJson(res, 400, { error: "Complete todos los datos de la solicitud" });
      }
      const loan = { id: crypto.randomUUID(), ...body };
      loans.push(loan);
      return sendJson(res, 201, loan);
    } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }

  if (req.method === "POST" && url.pathname === "/api/mongo/connect") {
    try {
      const body = await readJson(req);
      const db = await connectMongo(body.uri, body.database);
      await db.admin().ping();
      return sendJson(res, 200, { connected: true, database: db.databaseName });
    } catch (error) { return sendJson(res, 400, { connected: false, error: error.message }); }
  }

  return sendJson(res, 404, { error: "Ruta no encontrada" });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);

    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.normalize(path.join(ROOT, requested));
    if (!filePath.startsWith(ROOT)) return sendJson(res, 403, { error: "Acceso denegado" });

    fs.readFile(filePath, (error, content) => {
      if (error) return sendJson(res, 404, { error: "Archivo no encontrado" });
      res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
      res.end(content);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`Biblioteca Alameda disponible en http://localhost:${port}`));
}

module.exports = { createServer, catalog };
