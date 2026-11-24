const crypto = require("node:crypto");
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
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

function createAuthToken(account) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está configurada");
  const normalizedSecret = String(secret).replace(/^"|"$/g, "");
  const payload = Buffer.from(JSON.stringify({
    username: account.username,
    role: account.role,
    expiresAt: Date.now() + (8 * 60 * 60 * 1000)
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", normalizedSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const normalizedSecret = String(secret).replace(/^"|"$/g, "");
  const expected = crypto.createHmac("sha256", normalizedSecret).update(payload).digest("base64url");
  if (signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.username || !data.role || Number(data.expiresAt) <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function getRequestAuth(req) {
  const authorization = req?.headers?.authorization || req?.headers?.Authorization || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (bearer) return verifyAuthToken(bearer);

  const cookie = req.headers?.cookie || "";
  const match = cookie.match(/(?:^|;\s*)biblioteca_token=([^;]+)/);
  return verifyAuthToken(match ? decodeURIComponent(match[1]) : null);
}

function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `biblioteca_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`);
}

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

  type AuthResult {
    ok: Boolean!
    username: String
    role: String
    message: String
  }

  type ComplexStat {
    label: String!
    value: Float!
    count: Int!
    details: String
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
    authStatus: AuthResult!

    karlaUsersByStatus: [ComplexStat!]!
    karlaUsersByOccupation: [ComplexStat!]!
    karlaUsersByPostalCode: [ComplexStat!]!
    karlaPendingUsersByOccupation: [ComplexStat!]!
    karlaApprovedUsersByWorkplace: [ComplexStat!]!
    karlaDuplicateFullNames: [ComplexStat!]!
    karlaCredentialUsersByPostalCode: [ComplexStat!]!
    karlaUsersWithoutPhone: [ComplexStat!]!
    karlaUsersByPostalAndOccupation: [ComplexStat!]!
    karlaUsersWithLoansByStatus: [ComplexStat!]!

    franciscoLoansByStatus: [ComplexStat!]!
    franciscoLoansByMonth: [ComplexStat!]!
    franciscoTopBorrowedBooks: [ComplexStat!]!
    franciscoMostActiveBorrowers: [ComplexStat!]!
    franciscoOverdueActiveLoans: [ComplexStat!]!
    franciscoLoansByReturnMonth: [ComplexStat!]!
    franciscoAverageDurationByMonth: [ComplexStat!]!
    franciscoLoanStatusByBorrower: [ComplexStat!]!
    franciscoReturnedRateByMonth: [ComplexStat!]!
    franciscoTopLibraryNumbers: [ComplexStat!]!

    saulTopAuthors: [ComplexStat!]!
    saulBooksByLocationPrefix: [ComplexStat!]!
    saulBooksByVolume: [ComplexStat!]!
    saulBooksByAvailability: [ComplexStat!]!
    saulBooksByClassifierRange: [ComplexStat!]!
    saulLocationsWithHighestStock: [ComplexStat!]!
    saulAuthorLocationMatrix: [ComplexStat!]!
    saulTopClassifiers: [ComplexStat!]!
    saulSubjectDistribution: [ComplexStat!]!
    saulAuthorsWithLowAvailability: [ComplexStat!]!
  }

  type Mutation {
    login(username: String!, password: String!): AuthResult!
    logout: AuthResult!
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

async function runComplexAggregation(collectionName, pipeline) {
  if (!mongoDb) return [];
  const rows = await mongoDb.collection(collectionName).aggregate(pipeline).toArray();
  return rows.map(row => ({
    label: String(row.label ?? row._id ?? "Sin datos"),
    value: Number(row.value ?? row.count ?? 0),
    count: Number(row.count ?? 0),
    details: row.details ? String(row.details) : null
  }));
}

function requireAdmin(context) {
  const auth = getRequestAuth(context?.req);
  if (auth?.role !== "admin") {
    throw new Error("Se requiere una sesión de administrador");
  }
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
    }),
    authStatus: (_parent, _args, context) => ({
      ok: Boolean(context.req?.session?.role),
      username: context.req?.session?.username || null,
      role: context.req?.session?.role || null,
      message: context.req?.session?.role ? "Sesión activa" : "Sin sesión"
    }),

    karlaUsersByStatus: () => runComplexAggregation("users", [
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } }
    ]),
    karlaUsersByOccupation: () => runComplexAggregation("users", [
      { $group: { _id: "$occupation", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } }
    ]),
    karlaUsersByPostalCode: () => runComplexAggregation("users", [
      { $match: { postalCode: { $ne: null } } },
      { $group: { _id: "$postalCode", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]),
    karlaPendingUsersByOccupation: () => runComplexAggregation("users", [
      { $match: { status: "pending" } },
      { $group: { _id: "$occupation", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } }
    ]),
    karlaApprovedUsersByWorkplace: () => runComplexAggregation("users", [
      { $match: { status: "approved" } },
      { $group: { _id: "$workplace", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]),
    karlaDuplicateFullNames: () => runComplexAggregation("users", [
      { $group: { _id: "$fullName", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } }
    ]),
    karlaCredentialUsersByPostalCode: () => runComplexAggregation("users", [
      { $match: { status: "approved", credentialNumber: { $ne: null } } },
      { $group: { _id: "$postalCode", credentialed: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$credentialed", count: "$credentialed" } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]),
    karlaUsersWithoutPhone: () => runComplexAggregation("users", [
      { $match: { $or: [{ phone: { $exists: false } }, { phone: "" }, { phone: null }] } },
      { $group: { _id: "$occupation", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } }
    ]),
    karlaUsersByPostalAndOccupation: () => runComplexAggregation("users", [
      { $group: { _id: { postalCode: "$postalCode", occupation: "$occupation" }, count: { $sum: 1 } } },
      { $project: { _id: 0, label: { $concat: ["$_id.postalCode", " - ", "$_id.occupation"] }, value: "$count", count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 30 }
    ]),
    karlaUsersWithLoansByStatus: () => runComplexAggregation("users", [
      { $lookup: { from: "loans", localField: "libraryNumber", foreignField: "libraryNumber", as: "loans" } },
      { $unwind: "$loans" },
      { $group: { _id: "$loans.status", users: { $addToSet: "$id" } } },
      { $project: { _id: 0, label: "$_id", value: { $size: "$users" }, count: { $size: "$users" } } },
      { $sort: { count: -1 } }
    ]),

    franciscoLoansByStatus: () => runComplexAggregation("loans", [
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } }
    ]),
    franciscoLoansByMonth: () => runComplexAggregation("loans", [
      { $project: { month: { $substr: ["$loanDate", 0, 7] } } },
      { $group: { _id: "$month", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { label: 1 } }
    ]),
    franciscoTopBorrowedBooks: () => runComplexAggregation("loans", [
      { $group: { _id: "$bookId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $lookup: { from: "books", localField: "_id", foreignField: "id", as: "book" } },
      { $unwind: { path: "$book", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, label: { $ifNull: ["$book.title", "$_id"] }, value: "$count", count: 1 } }
    ]),
    franciscoMostActiveBorrowers: () => runComplexAggregation("loans", [
      { $group: { _id: "$libraryNumber", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $lookup: { from: "users", localField: "_id", foreignField: "libraryNumber", as: "user" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, label: { $ifNull: ["$user.fullName", "$_id"] }, value: "$count", count: 1 } }
    ]),
    franciscoOverdueActiveLoans: () => runComplexAggregation("loans", [
      { $match: { status: "active", returnDate: { $lt: "2026-11-23" } } },
      { $group: { _id: "$libraryNumber", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]),
    franciscoLoansByReturnMonth: () => runComplexAggregation("loans", [
      { $project: { month: { $substr: ["$returnDate", 0, 7] } } },
      { $group: { _id: "$month", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { label: 1 } }
    ]),
    franciscoAverageDurationByMonth: () => runComplexAggregation("loans", [
      { $project: {
        month: { $substr: ["$loanDate", 0, 7] },
        duration: { $divide: [{ $subtract: [{ $dateFromString: { dateString: "$returnDate" } }, { $dateFromString: { dateString: "$loanDate" } }] }, 86400000] }
      } },
      { $group: { _id: "$month", averageDays: { $avg: "$duration" }, count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: { $round: ["$averageDays", 1] }, count: 1 } },
      { $sort: { label: 1 } }
    ]),
    franciscoLoanStatusByBorrower: () => runComplexAggregation("loans", [
      { $lookup: { from: "users", localField: "libraryNumber", foreignField: "libraryNumber", as: "borrower" } },
      { $unwind: { path: "$borrower", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { borrower: "$borrower.fullName", status: "$status" }, count: { $sum: 1 } } },
      { $project: { _id: 0, label: { $concat: [{ $ifNull: ["$_id.borrower", "Sin usuario"] }, " - ", "$_id.status"] }, value: "$count", count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 30 }
    ]),
    franciscoReturnedRateByMonth: () => runComplexAggregation("loans", [
      { $project: { month: { $substr: ["$loanDate", 0, 7] }, returned: { $cond: [{ $eq: ["$status", "returned"] }, 1, 0] } } },
      { $group: { _id: "$month", count: { $sum: 1 }, returned: { $sum: "$returned" } } },
      { $project: { _id: 0, label: "$_id", value: { $round: [{ $multiply: [{ $divide: ["$returned", "$count"] }, 100] }, 1] }, count: 1 } },
      { $sort: { label: 1 } }
    ]),
    franciscoTopLibraryNumbers: () => runComplexAggregation("loans", [
      { $group: { _id: "$libraryNumber", active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } }, total: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$total", count: "$active", details: { $concat: ["Activos: ", { $toString: "$active" }] } } },
      { $sort: { value: -1 } },
      { $limit: 20 }
    ]),

    saulTopAuthors: () => runComplexAggregation("books", [
      { $group: { _id: "$author", count: { $sum: 1 }, stock: { $sum: "$total" } } },
      { $project: { _id: 0, label: "$_id", value: "$stock", count: "$count", details: { $concat: ["Ejemplares: ", { $toString: "$stock" }] } } },
      { $sort: { value: -1 } }
    ]),
    saulBooksByLocationPrefix: () => runComplexAggregation("books", [
      { $project: { prefix: { $substr: ["$location", 11, 1] } } },
      { $group: { _id: "$prefix", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } }
    ]),
    saulBooksByVolume: () => runComplexAggregation("books", [
      { $group: { _id: "$volume", count: { $sum: 1 }, stock: { $sum: "$total" } } },
      { $project: { _id: 0, label: "$_id", value: "$stock", count: 1 } },
      { $sort: { value: -1 } }
    ]),
    saulBooksByAvailability: () => runComplexAggregation("books", [
      { $bucket: { groupBy: "$total", boundaries: [1, 3, 5, 7, 9], default: "9+", output: { count: { $sum: 1 }, stock: { $sum: "$total" } } } },
      { $project: { _id: 0, label: { $toString: "$_id" }, value: "$stock", count: "$count" } }
    ]),
    saulBooksByClassifierRange: () => runComplexAggregation("books", [
      { $project: { range: { $substr: ["$classifier", 0, 1] } } },
      { $group: { _id: "$range", count: { $sum: 1 } } },
      { $project: { _id: 0, label: { $concat: ["$_id", "00 - ", "$_id", "99"] }, value: "$count", count: 1 } },
      { $sort: { label: 1 } }
    ]),
    saulLocationsWithHighestStock: () => runComplexAggregation("books", [
      { $group: { _id: "$location", count: { $sum: 1 }, stock: { $sum: "$total" } } },
      { $project: { _id: 0, label: "$_id", value: "$stock", count: 1 } },
      { $sort: { value: -1 } },
      { $limit: 20 }
    ]),
    saulAuthorLocationMatrix: () => runComplexAggregation("books", [
      { $project: { author: "$author", prefix: { $substr: ["$location", 11, 1] }, total: "$total" } },
      { $group: { _id: { author: "$author", location: "$prefix" }, count: { $sum: 1 }, stock: { $sum: "$total" } } },
      { $project: { _id: 0, label: { $concat: ["$_id.author", " - ", "$_id.location"] }, value: "$stock", count: "$count" } },
      { $sort: { value: -1 } },
      { $limit: 30 }
    ]),
    saulTopClassifiers: () => runComplexAggregation("books", [
      { $group: { _id: "$classifier", count: { $sum: 1 }, stock: { $sum: "$total" } } },
      { $project: { _id: 0, label: "$_id", value: "$stock", count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]),
    saulSubjectDistribution: () => runComplexAggregation("books", [
      { $project: { subject: { $arrayElemAt: [{ $split: ["$title", " de la Biblioteca"] }, 0] } } },
      { $group: { _id: "$subject", count: { $sum: 1 } } },
      { $project: { _id: 0, label: "$_id", value: "$count", count: 1 } },
      { $sort: { count: -1 } }
    ]),
    saulAuthorsWithLowAvailability: () => runComplexAggregation("books", [
      { $group: { _id: "$author", averageStock: { $avg: "$total" }, stock: { $sum: "$total" }, count: { $sum: 1 } } },
      { $match: { averageStock: { $lt: 5 } } },
      { $project: { _id: 0, label: "$_id", value: { $round: ["$averageStock", 2] }, count: "$count", details: { $concat: ["Stock total: ", { $toString: "$stock" }] } } },
      { $sort: { value: 1 } }
    ])
  },
  Mutation: {
    login: async (_parent, { username, password }, context) => {
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const account = await mongoDb.collection("accounts").findOne({ username });
      if (!account || !await bcrypt.compare(password, account.passwordHash)) {
        throw new Error("Usuario o contraseña incorrectos");
      }
      const token = createAuthToken(account);
      setAuthCookie(context.res, token);
      return { ok: true, username: account.username, role: account.role, message: "Sesión iniciada" };
    },
    logout: (_parent, _args, context) => {
      context.res.setHeader("Set-Cookie", "biblioteca_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax");
      return { ok: true, username: null, role: null, message: "Sesión cerrada" };
    },
    createUser: async (_parent, { input }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      if (!input.fullName || !input.idDocument || !input.address) {
        throw new Error("El nombre completo, documento y domicilio son obligatorios");
      }
      if (input.addressProofType !== "INE" || !input.addressProof) {
        throw new Error("El comprobante de domicilio debe ser una INE");
      }
      if (!/\.(pdf|jpg|jpeg|png)$/i.test(input.addressProof)) {
        throw new Error("El comprobante debe ser PDF, JPG, JPEG o PNG");
      }
      const user = { id: crypto.randomUUID(), ...input, status: "pending", credentialNumber: null };
      await mongoDb.collection("users").insertOne(user);
      return user;
    },
    approveUser: async (_parent, { id }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const user = await mongoDb.collection("users").findOne({ id });
      if (!user) throw new Error("Usuario no encontrado");
      if (user.status !== "approved") {
        user.status = "approved";
        user.credentialNumber = `BA-${Date.now().toString().slice(-8)}`;
        await mongoDb.collection("users").updateOne(
          { id: user.id },
          { $set: { status: "approved", credentialNumber: user.credentialNumber } }
        );
      }
      return user;
    },
    createLoan: async (_parent, { input }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      if (!input.title || !input.loanDate || !input.returnDate || !input.libraryNumber) {
        throw new Error("Complete todos los datos de la solicitud");
      }
      const loan = { id: crypto.randomUUID(), ...input, status: input.status || "active" };
      await mongoDb.collection("loans").insertOne(loan);
      return loan;
    },
    updateUser: async (_parent, { id, input }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const user = await mongoDb.collection("users").findOne({ id });
      if (!user) throw new Error("Usuario no encontrado");
      Object.assign(user, input);
      await mongoDb.collection("users").updateOne({ id }, { $set: input });
      return user;
    },
    deleteUser: async (_parent, { id }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const result = await mongoDb.collection("users").deleteOne({ id });
      const deleted = result.deletedCount > 0;
      return { ok: deleted, message: deleted ? "Usuario eliminado" : "Usuario no encontrado" };
    },
    updateLoan: async (_parent, { id, input }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const loan = await mongoDb.collection("loans").findOne({ id });
      if (!loan) throw new Error("Préstamo no encontrado");
      Object.assign(loan, input);
      await mongoDb.collection("loans").updateOne({ id }, { $set: input });
      return loan;
    },
    deleteLoan: async (_parent, { id }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const result = await mongoDb.collection("loans").deleteOne({ id });
      const deleted = result.deletedCount > 0;
      return { ok: deleted, message: deleted ? "Préstamo eliminado" : "Préstamo no encontrado" };
    },
    createBook: async (_parent, { input }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      if (!input.title || !input.author || !input.classifier) {
        throw new Error("Complete título, autor y clasificador");
      }
      const book = { id: `BOOK-${crypto.randomUUID()}`, ...input };
      await mongoDb.collection("books").insertOne(book);
      return book;
    },
    updateBook: async (_parent, { id, input }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const book = await mongoDb.collection("books").findOne({ id });
      if (!book) throw new Error("Libro no encontrado");
      Object.assign(book, input);
      await mongoDb.collection("books").updateOne({ id }, { $set: input });
      return book;
    },
    deleteBook: async (_parent, { id }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const result = await mongoDb.collection("books").deleteOne({ id });
      const deleted = result.deletedCount > 0;
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

  const candidates = [uri];
  let username = process.env.MONGODB_USERNAME;
  let password = process.env.MONGODB_PASSWORD;

  if (!username || !password) {
    const match = uri.match(/^mongodb(?:\+srv)?:\/\/([^:@]+):([^@]+)@/);
    if (match) {
      username = decodeURIComponent(match[1]);
      password = decodeURIComponent(match[2]);
    }
  }

  if (username && password) {
    username = encodeURIComponent(username);
    password = encodeURIComponent(password);
    const srvUri = `mongodb+srv://${username}:${password}@clusterlabo.voj4kvr.mongodb.net/biblioteca_alameda?retryWrites=true&w=majority`;
    if (uri.startsWith("mongodb+srv://")) {
      candidates.push(
        `mongodb://${username}:${password}@ac-fr60g4z-shard-00-00.voj4kvr.mongodb.net:27017,ac-fr60g4z-shard-00-01.voj4kvr.mongodb.net:27017,ac-fr60g4z-shard-00-02.voj4kvr.mongodb.net:27017/biblioteca_alameda?ssl=true&authSource=admin&retryWrites=true&w=majority`
      );
    } else {
      candidates.unshift(srvUri);
    }
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const client = new MongoClient(candidate, { serverSelectionTimeoutMS: 15000 });
      await client.connect();
      await client.db(databaseName || "biblioteca_alameda").admin().ping();
      mongoClient = client;
      break;
    } catch (error) {
      lastError = error;
      if (mongoClient) await mongoClient.close();
    }
  }

  if (!mongoClient) throw lastError || new Error("No fue posible conectar a MongoDB Atlas");
  mongoDb = mongoClient.db(databaseName || "biblioteca_alameda");
  mongoConnected = true;
  return mongoDb;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/auth/status") {
    const auth = getRequestAuth(req);
    return sendJson(res, 200, {
      ok: auth?.role === "admin",
      username: auth?.username || null,
      role: auth?.role || null
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    try {
      const body = await readJson(req);
      if (!mongoDb) return sendJson(res, 503, { error: "MongoDB no está disponible" });
      const account = await mongoDb.collection("accounts").findOne({ username: body.username });
      if (!account || !await bcrypt.compare(body.password || "", account.passwordHash)) {
        return sendJson(res, 401, { error: "Usuario o contraseña incorrectos" });
      }
      const token = createAuthToken(account);
      setAuthCookie(res, token);
      return sendJson(res, 200, { ok: true, username: account.username, role: account.role, token });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    res.setHeader("Set-Cookie", "biblioteca_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax");
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/mongo/status") {
    return sendJson(res, 200, {
      connected: mongoConnected,
      database: mongoConnected ? mongoDb?.databaseName || null : null
    });
  }

  if (req.method === "GET" && url.pathname === "/api/users/pending") {
    const pending = mongoDb
      ? await mongoDb.collection("users").find({ status: "pending" }).toArray()
      : users.filter(user => user.status === "pending");
    return sendJson(res, 200, pending);
  }

  return sendJson(res, 404, { error: "Ruta no encontrada" });
}

async function createServer() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(session({
    name: "biblioteca.sid",
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000
    }
  }));

  app.get("/health", (_req, res) => {
    sendJson(res, 200, {
      ok: true,
      mongo: mongoConnected,
      database: mongoConnected ? mongoDb?.databaseName || null : null
    });
  });

  app.use("/api", (req, res) => {
    const url = new URL(req.originalUrl, "http://localhost");
    return handleApi(req, res, url);
  });

  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use("/graphql", express.json({ limit: "1mb" }), expressMiddleware(apollo, {
    context: async ({ req, res }) => ({ req, res })
  }));

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
