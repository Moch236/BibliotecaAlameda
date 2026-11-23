const crypto = require("node:crypto");
require("dotenv").config();

const express = require("express");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@as-integrations/express5");
const { MongoClient } = require("mongodb");

const ROOT = __dirname;
const catalog = [
  { id: "1", title: "Cien años de soledad", author: "Gabriel García Márquez", classifier: "863 G163c", total: 4, volume: "Edición conmemorativa", location: "Estantería A-12" },
  { id: "2", title: "Pedro Páramo", author: "Juan Rulfo", classifier: "863 R936p", total: 3, volume: "Volumen único", location: "Estantería B-04" },
  { id: "3", title: "El laberinto de la soledad", author: "Octavio Paz", classifier: "972 P348l", total: 2, volume: "Tomo I", location: "Estantería C-07" }
];
const users = [];
const loans = [];
let mongoClient = null;
let mongoDb = null;
let mongoConnected = false;

const typeDefs = `#graphql
  type Book {
    id: ID!
    title: String!
    author: String!
    classifier: String!
    total: Int!
    volume: String
    location: String
  }

  type User {
    id: ID!
    fullName: String!
    idDocument: String!
    address: String!
    postalCode: String
    phone: String
    email: String
    occupation: String
    workplace: String
    addressProofType: String!
    addressProof: String!
    photo: String
    emergencyContact: String
    status: String!
    credentialNumber: String
  }

  type Loan {
    id: ID!
    title: String!
    loanDate: String!
    returnDate: String!
    libraryNumber: String!
    status: String
  }

  type MongoStatus {
    connected: Boolean!
    database: String
  }

  type MutationResult {
    ok: Boolean!
    message: String
  }

  input UserInput {
    fullName: String!
    idDocument: String!
    address: String!
    postalCode: String
    phone: String
    email: String
    occupation: String
    workplace: String
    addressProofType: String!
    addressProof: String!
    photo: String
    emergencyContact: String
  }

  input LoanInput {
    title: String!
    loanDate: String!
    returnDate: String!
    libraryNumber: String!
    status: String
  }

  input BookInput {
    title: String!
    author: String!
    classifier: String!
    total: Int!
    volume: String
    location: String
  }

  input UpdateBookInput {
    title: String
    author: String
    classifier: String
    total: Int
    volume: String
    location: String
  }

  input UpdateUserInput {
    fullName: String
    idDocument: String
    address: String
    postalCode: String
    phone: String
    email: String
    occupation: String
    workplace: String
    addressProofType: String
    addressProof: String
    photo: String
    emergencyContact: String
  }

  input UpdateLoanInput {
    title: String
    loanDate: String
    returnDate: String
    libraryNumber: String
    status: String
  }

  type Query {
    books(field: String, query: String): [Book!]!
    pendingUsers: [User!]!
    users(limit: Int): [User!]!
    loans(limit: Int): [Loan!]!
    mongoStatus: MongoStatus!
  }

  type Mutation {
    createUser(input: UserInput!): User!
    approveUser(id: ID!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deleteUser(id: ID!): MutationResult!
    createLoan(input: LoanInput!): Loan!
    updateLoan(id: ID!, input: UpdateLoanInput!): Loan!
    deleteLoan(id: ID!): MutationResult!
    createBook(input: BookInput!): Book!
    updateBook(id: ID!, input: UpdateBookInput!): Book!
    deleteBook(id: ID!): MutationResult!
  }
`;

async function filterCatalog(field, query) {
  const normalized = (query || "").trim().toLowerCase();
  const source = mongoDb ? await mongoDb.collection("books").find({}).toArray() : catalog;
  return normalized
    ? source.filter(book => {
        const value = field === "title" ? book.title
          : field === "author" ? book.author
          : field === "classifier" ? book.classifier
          : `${book.title} ${book.author} ${book.classifier}`;
        return value.toLowerCase().includes(normalized);
      })
    : source;
}

const resolvers = {
  Query: {
    books: (_parent, args) => filterCatalog(args.field, args.query),
    pendingUsers: async () => mongoDb
      ? mongoDb.collection("users").find({ status: "pending" }).toArray()
      : users.filter(user => user.status === "pending"),
    users: async (_parent, args) => mongoDb
      ? mongoDb.collection("users").find({}).limit(args.limit || 100).toArray()
      : users.slice(0, args.limit || 100),
    loans: async (_parent, args) => mongoDb
      ? mongoDb.collection("loans").find({}).limit(args.limit || 100).toArray()
      : loans.slice(0, args.limit || 100),
    mongoStatus: () => ({
      connected: mongoConnected,
      database: mongoConnected ? mongoDb?.databaseName || null : null
    })
  },
  Mutation: {
    createUser: async (_parent, { input }) => {
      if (!input.fullName || !input.idDocument || !input.address) {
        throw new Error("El nombre completo, documento y domicilio son obligatorios");
      }
      if (input.addressProofType !== "INE" || !input.addressProof) {
        throw new Error("El comprobante de domicilio debe ser una INE");
      }
      const user = { id: crypto.randomUUID(), ...input, status: "pending", credentialNumber: null };
      users.push(user);
      if (mongoDb) await mongoDb.collection("users").insertOne(user);
      return user;
    },
    approveUser: async (_parent, { id }) => {
      let user = users.find(item => item.id === id);
      if (!user && mongoDb) {
        user = await mongoDb.collection("users").findOne({
          $or: [{ id }, { _id: id }]
        });
      }
      if (!user) throw new Error("Usuario no encontrado");
      if (user.status !== "approved") {
        user.status = "approved";
        user.credentialNumber = `BA-${Date.now().toString().slice(-8)}`;
        if (mongoDb) await mongoDb.collection("users").updateOne(
          { id: user.id },
          { $set: { status: "approved", credentialNumber: user.credentialNumber } }
        );
      }
      return user;
    },
    createLoan: async (_parent, { input }) => {
      if (!input.title || !input.loanDate || !input.returnDate || !input.libraryNumber) {
        throw new Error("Complete todos los datos de la solicitud");
      }
      const loan = { id: crypto.randomUUID(), ...input, status: input.status || "active" };
      loans.push(loan);
      if (mongoDb) await mongoDb.collection("loans").insertOne(loan);
      return loan;
    },
    updateUser: async (_parent, { id, input }) => {
      let user = users.find(item => item.id === id);
      if (!user && mongoDb) user = await mongoDb.collection("users").findOne({ id });
      if (!user) throw new Error("Usuario no encontrado");
      Object.assign(user, input);
      if (mongoDb) await mongoDb.collection("users").updateOne({ id }, { $set: input });
      return user;
    },
    deleteUser: async (_parent, { id }) => {
      const inMemoryIndex = users.findIndex(item => item.id === id);
      if (inMemoryIndex >= 0) users.splice(inMemoryIndex, 1);
      let deleted = inMemoryIndex >= 0;
      if (mongoDb) {
        const result = await mongoDb.collection("users").deleteOne({ id });
        deleted = deleted || result.deletedCount > 0;
      }
      return { ok: deleted, message: deleted ? "Usuario eliminado" : "Usuario no encontrado" };
    },
    updateLoan: async (_parent, { id, input }) => {
      let loan = loans.find(item => item.id === id);
      if (!loan && mongoDb) loan = await mongoDb.collection("loans").findOne({ id });
      if (!loan) throw new Error("Préstamo no encontrado");
      Object.assign(loan, input);
      if (mongoDb) await mongoDb.collection("loans").updateOne({ id }, { $set: input });
      return loan;
    },
    deleteLoan: async (_parent, { id }) => {
      const inMemoryIndex = loans.findIndex(item => item.id === id);
      if (inMemoryIndex >= 0) loans.splice(inMemoryIndex, 1);
      let deleted = inMemoryIndex >= 0;
      if (mongoDb) {
        const result = await mongoDb.collection("loans").deleteOne({ id });
        deleted = deleted || result.deletedCount > 0;
      }
      return { ok: deleted, message: deleted ? "Préstamo eliminado" : "Préstamo no encontrado" };
    },
    createBook: async (_parent, { input }) => {
      if (!input.title || !input.author || !input.classifier) {
        throw new Error("Complete título, autor y clasificador");
      }
      const book = { id: `BOOK-${crypto.randomUUID()}`, ...input };
      catalog.push(book);
      if (mongoDb) await mongoDb.collection("books").insertOne(book);
      return book;
    },
    updateBook: async (_parent, { id, input }) => {
      let book = catalog.find(item => item.id === id);
      if (!book && mongoDb) book = await mongoDb.collection("books").findOne({ id });
      if (!book) throw new Error("Libro no encontrado");
      Object.assign(book, input);
      if (mongoDb) await mongoDb.collection("books").updateOne({ id }, { $set: input });
      return book;
    },
    deleteBook: async (_parent, { id }) => {
      const inMemoryIndex = catalog.findIndex(item => item.id === id);
      if (inMemoryIndex >= 0) catalog.splice(inMemoryIndex, 1);
      let deleted = inMemoryIndex >= 0;
      if (mongoDb) {
        const result = await mongoDb.collection("books").deleteOne({ id });
        deleted = deleted || result.deletedCount > 0;
      }
      return { ok: deleted, message: deleted ? "Libro eliminado" : "Libro no encontrado" };
    }
  }
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
  if (mongoClient) {
    await mongoClient.close();
    mongoConnected = false;
  }
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  mongoDb = mongoClient.db(databaseName || "biblioteca_alameda");
  mongoConnected = true;
  return mongoDb;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/mongo/status") {
    return sendJson(res, 200, {
      connected: mongoConnected,
      database: mongoConnected ? mongoDb?.databaseName || null : null
    });
  }

  if (req.method === "GET" && url.pathname === "/api/catalog") {
    const results = await filterCatalog(url.searchParams.get("field"), url.searchParams.get("query"));
    return sendJson(res, 200, results);
  }

  if (req.method === "POST" && url.pathname === "/api/users") {
    try {
      const body = await readJson(req);
      if (!body.fullName || !body.idDocument || !body.address) {
        return sendJson(res, 400, { error: "El nombre completo, documento y domicilio son obligatorios" });
      }
      if (body.addressProofType !== "INE" || !body.addressProof) {
        return sendJson(res, 400, { error: "El comprobante de domicilio debe ser una INE" });
      }
      const user = { id: crypto.randomUUID(), ...body, status: "pending", credentialNumber: null };
      users.push(user);
      if (mongoDb) await mongoDb.collection("users").insertOne(user);
      return sendJson(res, 201, user);
    } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }

  if (req.method === "GET" && url.pathname === "/api/users/pending") {
    return sendJson(res, 200, users.filter(user => user.status === "pending"));
  }

  const approvalMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/approve$/);
  if (req.method === "POST" && approvalMatch) {
    const userId = decodeURIComponent(approvalMatch[1]);
    let user = users.find(item => item.id === userId);
    if (!user && mongoDb) {
      user = await mongoDb.collection("users").findOne({
        $or: [{ id: userId }, { _id: userId }]
      });
    }
    if (!user) return sendJson(res, 404, { error: "Usuario no encontrado" });
    if (user.status === "approved") return sendJson(res, 200, user);
    user.status = "approved";
    user.credentialNumber = `BA-${Date.now().toString().slice(-8)}`;
    if (mongoDb) await mongoDb.collection("users").updateOne(
      { id: user.id },
      { $set: { status: "approved", credentialNumber: user.credentialNumber } }
    );
    return sendJson(res, 200, user);
  }

  if (req.method === "POST" && url.pathname === "/api/loans") {
    try {
      const body = await readJson(req);
      if (!body.title || !body.loanDate || !body.returnDate || !body.libraryNumber) {
        return sendJson(res, 400, { error: "Complete todos los datos de la solicitud" });
      }
      const loan = { id: crypto.randomUUID(), ...body };
      loans.push(loan);
      if (mongoDb) await mongoDb.collection("loans").insertOne(loan);
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

async function createServer() {
  const app = express();

  app.use("/api", (req, res) => {
    const url = new URL(req.originalUrl, "http://localhost");
    return handleApi(req, res, url);
  });

  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use("/graphql", express.json({ limit: "1mb" }), expressMiddleware(apollo));

  app.use(express.static(ROOT));
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const startServer = async () => {
    if (process.env.MONGODB_URI) {
      try {
        const db = await connectMongo(
          process.env.MONGODB_URI,
          process.env.MONGODB_DATABASE || "biblioteca_alameda"
        );
        await db.admin().ping();
        console.log(`MongoDB conectado a la base ${db.databaseName}`);
      } catch (error) {
        console.error(`No se pudo conectar a MongoDB: ${error.message}`);
      }
    } else {
      console.warn("MONGODB_URI no esta configurada en el archivo .env");
    }

    const app = await createServer();
    app.listen(port, () => {
      console.log(`Biblioteca Alameda disponible en http://localhost:${port}`);
    });
  };

  startServer();
}

module.exports = { createServer, catalog, connectMongo };
