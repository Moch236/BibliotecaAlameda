const crypto = require("node:crypto");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@as-integrations/express5");
const { GridFSBucket, MongoClient, ObjectId } = require("mongodb");

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

class RequestValidationError extends Error {}

const userDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, fieldSize: 4 * 1024, files: 2, fields: 20, parts: 22 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = file.fieldname === "addressProof"
      ? ["application/pdf", "image/jpeg", "image/png"]
      : file.fieldname === "photo"
        ? ["image/jpeg", "image/png"]
        : [];
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new RequestValidationError("Formato de archivo no permitido"));
    }
    return callback(null, true);
  }
});

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
  try {
    return verifyAuthToken(match ? decodeURIComponent(match[1]) : null);
  } catch {
    return null;
  }
}

function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `biblioteca_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`);
}

function clearAuthCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `biblioteca_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function getUserDocumentsBucket() {
  if (!mongoDb) throw new Error("MongoDB no está disponible");
  return new GridFSBucket(mongoDb, { bucketName: "userDocuments" });
}

function detectDocumentMime(buffer) {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  return null;
}

function validateUserRegistration(body, files) {
  const fieldLimits = {
    fullName: 160,
    idDocument: 100,
    address: 240,
    postalCode: 12,
    phone: 30,
    email: 160,
    occupation: 100,
    workplace: 140,
    addressProofType: 20,
    emergencyContact: 160
  };
  const requiredFields = ["fullName", "idDocument", "address"];
  const input = {};

  for (const [field, maxLength] of Object.entries(fieldLimits)) {
    const value = body[field] ?? "";
    if (typeof value !== "string") {
      throw new RequestValidationError(`El campo ${field} no es válido`);
    }
    const normalized = value.trim();
    if (normalized.length > maxLength || /[\u0000-\u001f]/.test(normalized)) {
      throw new RequestValidationError(`El campo ${field} excede el formato permitido`);
    }
    if (requiredFields.includes(field) && !normalized) {
      throw new RequestValidationError("Completa nombre, documento de identificación y domicilio");
    }
    input[field] = normalized;
  }

  if (input.addressProofType !== "INE") {
    throw new RequestValidationError("El comprobante requerido debe ser una INE");
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new RequestValidationError("El correo electrónico no tiene un formato válido");
  }

  const addressProof = files.addressProof?.[0];
  const photo = files.photo?.[0] || null;
  if (!addressProof) {
    throw new RequestValidationError("Adjunta el archivo del comprobante de identificación");
  }
  const validateFile = (file, kind) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedMime = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png"
    }[extension];
    const actualMime = detectDocumentMime(file.buffer);
    if (!expectedMime || expectedMime !== actualMime || actualMime !== file.mimetype
      || (kind === "photo" && actualMime === "application/pdf")) {
      throw new RequestValidationError(`El archivo de ${kind === "photo" ? "fotografía" : "comprobante"} no coincide con un formato permitido`);
    }
    return { extension, contentType: actualMime };
  };

  return {
    input,
    addressProof: { file: addressProof, ...validateFile(addressProof, "addressProof") },
    photo: photo ? { file: photo, ...validateFile(photo, "photo") } : null
  };
}

async function storeUserDocument(bucket, userId, kind, document) {
  const filename = `${kind === "addressProof" ? "comprobante" : "fotografia"}${document.extension}`;
  const stream = bucket.openUploadStream(filename, {
    metadata: { userId, kind, contentType: document.contentType }
  });
  try {
    await pipeline(Readable.from([document.file.buffer]), stream);
    return stream.id.toString();
  } catch (error) {
    try {
      await stream.abort();
    } catch (abortError) {
      console.error(`No se pudo limpiar una carga incompleta de GridFS: ${abortError.message}`);
    }
    throw error;
  }
}

async function deleteUserDocuments(user) {
  const fileIds = [user.addressProofFileId, user.photoFileId].filter(Boolean);
  if (!fileIds.length) return;
  const bucket = getUserDocumentsBucket();
  for (const fileId of fileIds) {
    if (!ObjectId.isValid(fileId)) {
      throw new Error("Un documento del usuario tiene una referencia de archivo inválida");
    }
    const file = await bucket.find({
      _id: new ObjectId(fileId),
      "metadata.userId": user.id
    }).next();
    if (file) await bucket.delete(file._id);
  }
}

function withoutPrivateDocumentRefs(user) {
  const { addressProofFileId, photoFileId, _id, ...safeUser } = user;
  return safeUser;
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
    libraryNumber: String
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
    hasAddressProof: Boolean!
    hasPhoto: Boolean!
    emergencyContact: String
    status: String!
    credentialNumber: String
  }

  type Loan {
    id: ID!
    title: String!
    bookId: String
    borrowerName: String
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
    books(field: String, query: String, limit: Int, offset: Int): [Book!]!
    bookCount(field: String, query: String): Int!
    pendingUsers: [User!]!
    users(limit: Int, offset: Int, query: String): [User!]!
    userCount(query: String): Int!
    loans(limit: Int, offset: Int, query: String): [Loan!]!
    loanCount(query: String): Int!
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

function searchFilter(fields, query) {
  const normalized = String(query || "").trim();
  if (!normalized) return {};
  const pattern = new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return { $or: fields.map(field => ({ [field]: pattern })) };
}

function pageValues(limit, offset, defaultLimit = 100) {
  return {
    limit: Math.min(Math.max(Number.isInteger(limit) ? limit : defaultLimit, 1), 100),
    offset: Math.max(Number.isInteger(offset) ? offset : 0, 0)
  };
}

function catalogFilter(field, query) {
  const fields = ["title", "author", "classifier"].includes(field) ? [field] : ["title", "author", "classifier"];
  return searchFilter(fields, query);
}

function exactTitleFilter(title) {
  const escaped = String(title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

async function filterCatalog(field, query, limit, offset) {
  const filter = catalogFilter(field, query);
  const page = pageValues(limit, offset);
  if (mongoDb) {
    let cursor = mongoDb.collection("books").find(filter).sort({ title: 1 });
    if (limit !== undefined) cursor = cursor.skip(page.offset).limit(page.limit);
    return cursor.toArray();
  }

  const source = catalog.filter(book => {
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) return true;
    const values = field === "title" ? [book.title]
      : field === "author" ? [book.author]
      : field === "classifier" ? [book.classifier]
      : [book.title, book.author, book.classifier];
    return values.some(value => value.toLowerCase().includes(normalized));
  }).sort((a, b) => a.title.localeCompare(b.title));
  return limit === undefined ? source : source.slice(page.offset, page.offset + page.limit);
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

function validateLoan(input) {
  const { title, loanDate, returnDate, libraryNumber, status } = input;
  if (!title?.trim() || !loanDate || !returnDate || !libraryNumber?.trim()) {
    throw new Error("Complete todos los datos de la solicitud");
  }
  const isCalendarDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!isCalendarDate(loanDate) || !isCalendarDate(returnDate)) {
    throw new Error("Use fechas válidas en formato AAAA-MM-DD");
  }
  if (returnDate < loanDate) {
    throw new Error("La fecha de devolución no puede ser anterior a la fecha del préstamo");
  }
  if (status !== undefined && !["active", "returned"].includes(status)) {
    throw new Error("El estado del préstamo debe ser active o returned");
  }
}

async function findBookByTitle(title) {
  return mongoDb.collection("books").findOne({ title: exactTitleFilter(title) });
}

async function countActiveLoansForBook(book, excludedLoanId) {
  return mongoDb.collection("loans").countDocuments({
    status: "active",
    $or: [
      { bookId: book.id },
      { bookId: { $exists: false }, title: exactTitleFilter(book.title) },
      { bookId: null, title: exactTitleFilter(book.title) }
    ],
    ...(excludedLoanId ? { _id: { $ne: excludedLoanId } } : {})
  });
}

async function ensureBookAvailable(book, excludedLoanId) {
  const activeLoans = await countActiveLoansForBook(book, excludedLoanId);
  if (!Number.isInteger(book.total) || book.total <= activeLoans) {
    throw new Error("No hay ejemplares disponibles para este libro");
  }
}

const resolvers = {
  User: {
    hasAddressProof: user => Boolean(user.addressProofFileId),
    hasPhoto: user => Boolean(user.photoFileId)
  },
  Query: {
    books: (_parent, args) => filterCatalog(args.field, args.query, args.limit, args.offset),
    bookCount: (_parent, args) => mongoDb
      ? mongoDb.collection("books").countDocuments(catalogFilter(args.field, args.query))
      : catalog.filter(book => {
          const normalized = String(args.query || "").trim().toLowerCase();
          if (!normalized) return true;
          const values = args.field === "title" ? [book.title]
            : args.field === "author" ? [book.author]
            : args.field === "classifier" ? [book.classifier]
            : [book.title, book.author, book.classifier];
          return values.some(value => value.toLowerCase().includes(normalized));
        }).length,
    pendingUsers: async () => mongoDb
      ? mongoDb.collection("users").find({ status: "pending" }).toArray()
      : users.filter(user => user.status === "pending"),
    users: async (_parent, args) => {
      const filter = searchFilter(["fullName", "email", "libraryNumber", "status"], args.query);
      const page = pageValues(args.limit, args.offset);
      return mongoDb
        ? mongoDb.collection("users").find(filter).skip(page.offset).limit(page.limit).toArray()
        : users.filter(user => {
            const normalized = String(args.query || "").trim().toLowerCase();
            return !normalized || [user.fullName, user.email, user.libraryNumber, user.status]
              .some(value => String(value || "").toLowerCase().includes(normalized));
          }).slice(page.offset, page.offset + page.limit);
    },
    userCount: (_parent, args) => {
      const filter = searchFilter(["fullName", "email", "libraryNumber", "status"], args.query);
      return mongoDb
        ? mongoDb.collection("users").countDocuments(filter)
        : users.filter(user => {
            const normalized = String(args.query || "").trim().toLowerCase();
            return !normalized || [user.fullName, user.email, user.libraryNumber, user.status]
              .some(value => String(value || "").toLowerCase().includes(normalized));
          }).length;
    },
    loans: async (_parent, args) => {
      const filter = searchFilter(["title", "libraryNumber", "status"], args.query);
      const page = pageValues(args.limit, args.offset);
      return mongoDb
        ? mongoDb.collection("loans").find(filter).skip(page.offset).limit(page.limit).toArray()
        : loans.filter(loan => {
            const normalized = String(args.query || "").trim().toLowerCase();
            return !normalized || [loan.title, loan.libraryNumber, loan.status]
              .some(value => String(value || "").toLowerCase().includes(normalized));
          }).slice(page.offset, page.offset + page.limit);
    },
    loanCount: (_parent, args) => {
      const filter = searchFilter(["title", "libraryNumber", "status"], args.query);
      return mongoDb
        ? mongoDb.collection("loans").countDocuments(filter)
        : loans.filter(loan => {
            const normalized = String(args.query || "").trim().toLowerCase();
            return !normalized || [loan.title, loan.libraryNumber, loan.status]
              .some(value => String(value || "").toLowerCase().includes(normalized));
          }).length;
    },
    mongoStatus: () => ({
      connected: mongoConnected,
      database: mongoConnected ? mongoDb?.databaseName || null : null
    }),
    authStatus: (_parent, _args, context) => {
      const auth = getRequestAuth(context.req);
      const isAdmin = auth?.role === "admin";
      return {
        ok: isAdmin,
        username: auth?.username || null,
        role: auth?.role || null,
        message: isAdmin ? "Sesión activa" : "Sin sesión"
      };
    },

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
      { $match: { status: "active", returnDate: { $lt: new Date().toISOString().slice(0, 10) } } },
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
      { $lookup: {
        from: "loans",
        let: { bookId: "$id", title: "$title" },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ["$status", "active"] },
            { $or: [
              { $eq: ["$bookId", "$$bookId"] },
              { $and: [
                { $eq: [{ $ifNull: ["$bookId", null] }, null] },
                { $eq: ["$title", "$$title"] }
              ] }
            ] }
          ] } } },
          { $count: "count" }
        ],
        as: "activeLoans"
      } },
      { $project: {
        available: { $max: [0, { $subtract: ["$total", { $ifNull: [{ $arrayElemAt: ["$activeLoans.count", 0] }, 0] }] }] }
      } },
      { $bucket: {
        groupBy: "$available",
        boundaries: [0, 1, 3, 5, 7, 9],
        default: "9+",
        output: { count: { $sum: 1 }, available: { $sum: "$available" } }
      } },
      { $project: {
        _id: 0,
        label: { $switch: {
          branches: [
            { case: { $eq: ["$_id", 0] }, then: "0 disponibles" },
            { case: { $eq: ["$_id", 1] }, then: "1-2 disponibles" },
            { case: { $eq: ["$_id", 3] }, then: "3-4 disponibles" },
            { case: { $eq: ["$_id", 5] }, then: "5-6 disponibles" },
            { case: { $eq: ["$_id", 7] }, then: "7-8 disponibles" }
          ],
          default: "9+ disponibles"
        } },
        value: "$available",
        count: 1
      } }
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
      { $lookup: {
        from: "loans",
        let: { bookId: "$id", title: "$title" },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ["$status", "active"] },
            { $or: [
              { $eq: ["$bookId", "$$bookId"] },
              { $and: [
                { $eq: [{ $ifNull: ["$bookId", null] }, null] },
                { $eq: ["$title", "$$title"] }
              ] }
            ] }
          ] } } },
          { $count: "count" }
        ],
        as: "activeLoans"
      } },
      { $project: {
        author: 1,
        available: { $max: [0, { $subtract: ["$total", { $ifNull: [{ $arrayElemAt: ["$activeLoans.count", 0] }, 0] }] }] }
      } },
      { $group: {
        _id: "$author",
        averageAvailable: { $avg: "$available" },
        available: { $sum: "$available" },
        count: { $sum: 1 }
      } },
      { $match: { averageAvailable: { $lt: 5 } } },
      { $project: {
        _id: 0,
        label: "$_id",
        value: { $round: ["$averageAvailable", 2] },
        count: 1,
        details: { $concat: ["Disponibles: ", { $toString: "$available" }] }
      } },
      { $sort: { value: 1 } }
    ])
  },
  Mutation: {
    login: async (_parent, { username, password }, context) => {
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const account = await mongoDb.collection("accounts").findOne({ username: username.trim() });
      if (!account || account.role !== "admin" || !await bcrypt.compare(password, account.passwordHash)) {
        throw new Error("Usuario o contraseña incorrectos");
      }
      const token = createAuthToken(account);
      setAuthCookie(context.res, token);
      return { ok: true, username: account.username, role: account.role, message: "Sesión iniciada" };
    },
    logout: (_parent, _args, context) => {
      clearAuthCookie(context.res);
      return { ok: true, username: null, role: null, message: "Sesión cerrada" };
    },
    approveUser: async (_parent, { id }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const user = await mongoDb.collection("users").findOne({ id });
      if (!user) throw new Error("Usuario no encontrado");
      if (user.status !== "approved") {
        user.status = "approved";
        user.libraryNumber ||= `BA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        user.credentialNumber = user.libraryNumber;
        await mongoDb.collection("users").updateOne(
          { id: user.id },
          { $set: {
            status: "approved",
            libraryNumber: user.libraryNumber,
            credentialNumber: user.credentialNumber
          } }
        );
      }
      return user;
    },
    createLoan: async (_parent, { input }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      validateLoan(input);
      const book = await findBookByTitle(input.title.trim());
      if (!book) throw new Error("No se encontró el libro seleccionado en el catálogo");
      if ((input.status || "active") === "active") await ensureBookAvailable(book);
      const borrower = await mongoDb.collection("users").findOne({
        libraryNumber: input.libraryNumber.trim(),
        status: "approved"
      });
      if (!borrower) throw new Error("El número de biblioteca no corresponde a un usuario aprobado");
      const loan = {
        id: crypto.randomUUID(),
        ...input,
        title: book.title,
        bookId: book.id,
        borrowerName: borrower.fullName,
        libraryNumber: borrower.libraryNumber,
        status: input.status || "active"
      };
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
      const user = await mongoDb.collection("users").findOne({ id });
      if (!user) return { ok: false, message: "Usuario no encontrado" };
      await deleteUserDocuments(user);
      const result = await mongoDb.collection("users").deleteOne({ id });
      const deleted = result.deletedCount > 0;
      return { ok: deleted, message: deleted ? "Usuario eliminado" : "Usuario no encontrado" };
    },
    updateLoan: async (_parent, { id, input }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const loan = await mongoDb.collection("loans").findOne({ id });
      if (!loan) throw new Error("Préstamo no encontrado");
      validateLoan({ ...loan, ...input });
      const changes = { ...input };
      let book = null;
      if (input.title !== undefined) {
        book = await findBookByTitle(input.title.trim());
        if (!book) throw new Error("No se encontró el libro seleccionado en el catálogo");
        changes.title = book.title;
        changes.bookId = book.id;
      }
      if (input.libraryNumber !== undefined) {
        const borrower = await mongoDb.collection("users").findOne({
          libraryNumber: input.libraryNumber.trim(),
          status: "approved"
        });
        if (!borrower) throw new Error("El número de biblioteca no corresponde a un usuario aprobado");
        changes.libraryNumber = borrower.libraryNumber;
        changes.borrowerName = borrower.fullName;
      }
      if ((input.status ?? loan.status) === "active"
        && (input.status !== undefined || input.title !== undefined)) {
        book ||= loan.bookId
          ? await mongoDb.collection("books").findOne({ id: loan.bookId })
          : await findBookByTitle(loan.title);
        if (!book) throw new Error("No se encontró el libro asociado al préstamo");
        await ensureBookAvailable(book, loan._id);
        changes.bookId = book.id;
      }
      Object.assign(loan, changes);
      await mongoDb.collection("loans").updateOne({ id }, { $set: changes });
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
      if (!Number.isInteger(input.total) || input.total < 0) {
        throw new Error("La cantidad de ejemplares debe ser un entero igual o mayor que cero");
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
      if (input.total !== undefined && (!Number.isInteger(input.total) || input.total < 0)) {
        throw new Error("La cantidad de ejemplares debe ser un entero igual o mayor que cero");
      }
      if (input.total !== undefined) {
        const activeLoans = await countActiveLoansForBook(book);
        if (input.total < activeLoans) {
          throw new Error("No puedes reducir el inventario por debajo de los préstamos activos");
        }
      }
      Object.assign(book, input);
      await mongoDb.collection("books").updateOne({ id }, { $set: input });
      return book;
    },
    deleteBook: async (_parent, { id }, context) => {
      requireAdmin(context);
      if (!mongoDb) throw new Error("MongoDB no está disponible");
      const book = await mongoDb.collection("books").findOne({ id });
      if (!book) return { ok: false, message: "Libro no encontrado" };
      if (await countActiveLoansForBook(book)) {
        throw new Error("No puedes eliminar un libro con préstamos activos");
      }
      const result = await mongoDb.collection("books").deleteOne({ id });
      const deleted = result.deletedCount > 0;
      return { ok: deleted, message: deleted ? "Libro eliminado" : "Libro no encontrado" };
    }
  }
};

const publicQueries = new Set(["authStatus", "bookCount", "books", "mongoStatus"]);
for (const [field, resolver] of Object.entries(resolvers.Query)) {
  if (publicQueries.has(field)) continue;
  resolvers.Query[field] = (parent, args, context, info) => {
    requireAdmin(context);
    return resolver(parent, args, context, info);
  };
}

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

function requireAdminApi(req, res, next) {
  if (getRequestAuth(req)?.role !== "admin") {
    return sendJson(res, 401, { error: "Se requiere una sesión de administrador" });
  }
  return next();
}

function requireMongoApi(_req, res, next) {
  if (!mongoDb) return sendJson(res, 503, { error: "MongoDB no está disponible" });
  return next();
}

function parseUserRegistrationFiles(req, res, next) {
  userDocumentUpload.fields([
    { name: "addressProof", maxCount: 1 },
    { name: "photo", maxCount: 1 }
  ])(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return sendJson(res, 413, { error: "Cada archivo debe pesar 5 MB o menos" });
    }
    if (error instanceof multer.MulterError) {
      return sendJson(res, 400, { error: "La solicitud contiene archivos o campos no permitidos" });
    }
    if (error instanceof RequestValidationError) {
      return sendJson(res, 400, { error: error.message });
    }
    console.error(`No se pudo procesar la carga de archivos: ${error.message}`);
    return sendJson(res, 400, { error: "No se pudo procesar la carga de archivos" });
  });
}

function validateUserRegistrationInput(req, res, next) {
  try {
    req.registration = validateUserRegistration(req.body || {}, req.files || {});
    return next();
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return sendJson(res, 400, { error: error.message });
    }
    console.error(`No se pudo validar la solicitud de usuario: ${error.message}`);
    return sendJson(res, 500, { error: "No fue posible validar la solicitud" });
  }
}

async function createUserFromRegistration(req, res) {
  let uploadedFileIds = [];
  let bucket;
  try {
    const registration = req.registration;
    const id = crypto.randomUUID();
    bucket = getUserDocumentsBucket();
    const addressProofFileId = await storeUserDocument(bucket, id, "addressProof", registration.addressProof);
    uploadedFileIds.push(addressProofFileId);
    let photoFileId = null;
    if (registration.photo) {
      photoFileId = await storeUserDocument(bucket, id, "photo", registration.photo);
      uploadedFileIds.push(photoFileId);
    }

    const user = {
      id,
      ...registration.input,
      addressProof: `comprobante${registration.addressProof.extension}`,
      photo: registration.photo ? `fotografia${registration.photo.extension}` : null,
      addressProofFileId,
      photoFileId,
      status: "pending",
      credentialNumber: null
    };
    await mongoDb.collection("users").insertOne(user);
    return sendJson(res, 201, {
      id: user.id,
      fullName: user.fullName,
      address: user.address,
      postalCode: user.postalCode,
      phone: user.phone,
      email: user.email,
      occupation: user.occupation,
      workplace: user.workplace,
      status: user.status,
      credentialNumber: user.credentialNumber
    });
  } catch (error) {
    for (const fileId of uploadedFileIds) {
      try {
        await bucket.delete(new ObjectId(fileId));
      } catch (cleanupError) {
        console.error(`No se pudo limpiar un archivo de registro fallido: ${cleanupError.message}`);
      }
    }
    if (error instanceof RequestValidationError) {
      return sendJson(res, 400, { error: error.message });
    }
    console.error(`No se pudo guardar la solicitud de usuario: ${error.message}`);
    return sendJson(res, 500, { error: "No fue posible guardar la solicitud. Inténtalo más tarde." });
  }
}

async function downloadUserDocument(req, res) {
  const { id, documentType } = req.params;
  if (!["addressProof", "photo"].includes(documentType)) {
    return sendJson(res, 404, { error: "Documento no encontrado" });
  }

  try {
    const user = await mongoDb.collection("users").findOne({ id });
    if (!user) return sendJson(res, 404, { error: "Documento no encontrado" });
    const fileId = documentType === "addressProof" ? user.addressProofFileId : user.photoFileId;
    if (!fileId || !ObjectId.isValid(fileId)) {
      return sendJson(res, 404, { error: "Documento no encontrado" });
    }

    const bucket = getUserDocumentsBucket();
    const file = await bucket.find({
      _id: new ObjectId(fileId),
      "metadata.userId": user.id,
      "metadata.kind": documentType
    }).next();
    if (!file) return sendJson(res, 404, { error: "Documento no encontrado" });

    const extension = {
      "application/pdf": ".pdf",
      "image/jpeg": ".jpg",
      "image/png": ".png"
    }[file.metadata?.contentType];
    if (!extension || (documentType === "photo" && file.metadata?.contentType === "application/pdf")) {
      return sendJson(res, 404, { error: "Documento no encontrado" });
    }

    const filename = `${documentType === "addressProof" ? "comprobante" : "fotografia"}${extension}`;
    res.setHeader("Content-Type", file.metadata.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const downloadStream = bucket.openDownloadStream(file._id);
    pipeline(downloadStream, res).catch(error => {
      console.error(`No se pudo descargar un documento de usuario: ${error.message}`);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "No fue posible descargar el documento" });
      } else {
        res.destroy();
      }
    });
  } catch (error) {
    console.error(`No se pudo preparar la descarga de un documento de usuario: ${error.message}`);
    return sendJson(res, 500, { error: "No fue posible descargar el documento" });
  }
}

async function connectMongo(uri, databaseName) {
  if (!uri) throw new Error("Se requiere la cadena de conexión de MongoDB Atlas");
  const previousClient = mongoClient;
  mongoClient = null;
  mongoDb = null;
  mongoConnected = false;
  if (previousClient) await previousClient.close();

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const database = client.db(databaseName || "biblioteca_alameda");
    await database.admin().ping();
    mongoClient = client;
    mongoDb = database;
    mongoConnected = true;
    return database;
  } catch (error) {
    try {
      await client.close();
    } catch (closeError) {
      console.error(`No se pudo cerrar el cliente MongoDB tras un fallo de conexión: ${closeError.message}`);
    }
    throw error;
  }
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
    let body;
    try {
      body = await readJson(req);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }

    if (!body || typeof body !== "object"
      || typeof body.username !== "string" || typeof body.password !== "string"
      || !body.username.trim() || !body.password) {
      return sendJson(res, 400, { error: "Ingresa usuario y contraseña" });
    }
    if (!mongoDb) return sendJson(res, 503, { error: "MongoDB no está disponible" });

    try {
      const account = await mongoDb.collection("accounts").findOne({ username: body.username.trim() });
      if (!account || account.role !== "admin"
        || !await bcrypt.compare(body.password, account.passwordHash)) {
        return sendJson(res, 401, { error: "Usuario o contraseña incorrectos" });
      }
      const token = createAuthToken(account);
      setAuthCookie(res, token);
      return sendJson(res, 200, { ok: true, username: account.username, role: account.role });
    } catch (error) {
      console.error(`No se pudo iniciar sesión: ${error.message}`);
      return sendJson(res, 500, { error: "No fue posible iniciar sesión. Inténtalo más tarde." });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    clearAuthCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/mongo/status") {
    return sendJson(res, mongoConnected ? 200 : 503, {
      connected: mongoConnected,
      database: mongoConnected ? mongoDb?.databaseName || null : null
    });
  }

  if (req.method === "GET" && url.pathname === "/api/users/pending") {
    if (getRequestAuth(req)?.role !== "admin") {
      return sendJson(res, 401, { error: "Se requiere una sesión de administrador" });
    }
    try {
      const pending = mongoDb
        ? await mongoDb.collection("users").find({ status: "pending" }).toArray()
        : users.filter(user => user.status === "pending");
      return sendJson(res, 200, pending.map(withoutPrivateDocumentRefs));
    } catch (error) {
      console.error(`No se pudieron consultar solicitudes pendientes: ${error.message}`);
      return sendJson(res, 500, { error: "No fue posible cargar las solicitudes pendientes" });
    }
  }

  return sendJson(res, 404, { error: "Ruta no encontrada" });
}

async function createServer() {
  const app = express();

  app.get("/health", (_req, res) => {
    sendJson(res, 200, {
      ok: true,
      mongo: mongoConnected,
      database: mongoConnected ? mongoDb?.databaseName || null : null
    });
  });

  app.post("/api/users", requireAdminApi, parseUserRegistrationFiles, validateUserRegistrationInput, requireMongoApi, createUserFromRegistration);
  app.get("/api/users/:id/documents/:documentType", requireAdminApi, requireMongoApi, downloadUserDocument);

  app.use("/api", (req, res) => {
    const url = new URL(req.originalUrl, "http://localhost");
    return handleApi(req, res, url);
  });

  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.locals.apolloServer = apollo;
  app.use("/graphql", express.json({ limit: "1mb" }), expressMiddleware(apollo, {
    context: async ({ req, res }) => ({ req, res })
  }));

  app.get(["/login", "/login.html"], (_req, res) => {
    res.sendFile(path.join(ROOT, "login.html"));
  });
  app.get(["/", "/index.html"], (req, res) => {
    if (getRequestAuth(req)?.role !== "admin") {
      return res.redirect(302, "/login");
    }
    return res.sendFile(path.join(ROOT, "index.html"));
  });
  app.get("/styles.css", (_req, res) => res.sendFile(path.join(ROOT, "styles.css")));
  app.get("/app.js", (_req, res) => res.sendFile(path.join(ROOT, "app.js")));
  app.get("/login.js", (_req, res) => res.sendFile(path.join(ROOT, "login.js")));
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
