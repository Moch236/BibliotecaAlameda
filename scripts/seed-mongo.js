require("dotenv").config();

const crypto = require("node:crypto");
const { MongoClient } = require("mongodb");

const DATABASE_NAME = process.env.MONGODB_DATABASE || "biblioteca_alameda";
const URI = process.env.MONGODB_URI;

if (!URI) {
  throw new Error("MONGODB_URI no esta configurada");
}
if (DATABASE_NAME !== "biblioteca_alameda") {
  throw new Error('MONGODB_DATABASE debe ser exactamente "biblioteca_alameda"');
}

const firstNames = ["Ana", "Luis", "María", "José", "Carmen", "Miguel", "Laura", "Carlos", "Lucía", "Juan"];
const lastNames = ["López", "García", "Martínez", "Hernández", "Ramírez", "Rodríguez", "Pérez", "González", "Flores", "Ruiz"];
const authors = [
  "Gabriel García Márquez", "Juan Rulfo", "Octavio Paz", "Isabel Allende", "Laura Esquivel",
  "Carlos Fuentes", "Sor Juana Inés de la Cruz", "Rosario Castellanos", "Julio Cortázar",
  "Mario Vargas Llosa", "Jorge Luis Borges", "Alfonsina Storni", "Pablo Neruda", "José Revueltas"
];
const subjects = ["Novela", "Poesía", "Ensayo", "Historia", "Ciencia", "Teatro", "Cuento", "Derecho"];

function padded(value, length) {
  return String(value).padStart(length, "0");
}

function createBooks() {
  return Array.from({ length: 1000 }, (_unused, index) => {
    const number = index + 1;
    const subject = subjects[index % subjects.length];
    const author = authors[index % authors.length];
    return {
      id: `BOOK-${padded(number, 4)}`,
      title: `${subject} de la Biblioteca ${padded(number, 4)}`,
      author,
      classifier: `${800 + (index % 170)} ${String.fromCharCode(65 + (index % 26))}${padded(number, 4).slice(-3)}`,
      total: 1 + (index % 8),
      volume: `Volumen ${(index % 12) + 1}`,
      location: `Estantería ${String.fromCharCode(65 + (index % 12))}-${padded((index % 30) + 1, 2)}`,
      seed: true
    };
  });
}

function createUsers() {
  return Array.from({ length: 1000 }, (_unused, index) => {
    const number = index + 1;
    const name = `${firstNames[index % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`;
    const approved = index % 4 !== 0;
    return {
      id: crypto.randomUUID(),
      libraryNumber: `BA-${padded(number, 5)}`,
      fullName: name,
      idDocument: `INE-${padded(number, 6)}`,
      address: `Calle Alameda ${number}, Tepic`,
      postalCode: String(63000 + (number % 100)),
      phone: `311${padded(1000000 + number, 7)}`,
      email: `usuario.${number}@biblioteca.test`,
      occupation: ["Estudiante", "Empleado", "Docente", "Comerciante"][index % 4],
      workplace: `Institución ${((index % 20) + 1)}`,
      addressProofType: "INE",
      addressProof: `ine-${padded(number, 4)}.pdf`,
      photo: "",
      emergencyContact: `Contacto ${number}`,
      status: approved ? "approved" : "pending",
      credentialNumber: approved ? `BA-${padded(number, 8)}` : null,
      seed: true
    };
  });
}

function createLoans(books) {
  const firstNamesByIndex = firstNames;
  return Array.from({ length: 1000 }, (_unused, index) => {
    const number = index + 1;
    const loanDate = new Date(Date.UTC(2026, 0, 1 + (index % 28)));
    const returnDate = new Date(loanDate);
    returnDate.setUTCDate(returnDate.getUTCDate() + 14);
    const book = books[index % books.length];
    return {
      id: crypto.randomUUID(),
      title: book.title,
      bookId: book.id,
      loanDate: loanDate.toISOString().slice(0, 10),
      returnDate: returnDate.toISOString().slice(0, 10),
      libraryNumber: `BA-${padded(((index % 1000) + 1), 5)}`,
      borrowerName: `${firstNamesByIndex[index % firstNamesByIndex.length]} ${lastNames[(index * 5) % lastNames.length]}`,
      status: index % 5 === 0 ? "returned" : "active",
      seed: true
    };
  });
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DATABASE_NAME);

  const books = createBooks();
  const users = createUsers();
  const loans = createLoans(books);

  await db.collection("books").deleteMany({});
  await db.collection("users").deleteMany({});
  await db.collection("loans").deleteMany({});

  await db.collection("books").insertMany(books);
  await db.collection("users").insertMany(users);
  await db.collection("loans").insertMany(loans);

  await db.collection("books").createIndex({ title: 1 });
  await db.collection("books").createIndex({ author: 1 });
  await db.collection("books").createIndex({ classifier: 1 });
  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ libraryNumber: 1 }, { unique: true });
  await db.collection("loans").createIndex({ id: 1 }, { unique: true });
  await db.collection("loans").createIndex({ libraryNumber: 1 });

  const counts = {
    books: await db.collection("books").countDocuments({}),
    users: await db.collection("users").countDocuments({}),
    loans: await db.collection("loans").countDocuments({})
  };

  console.log(`Base: ${DATABASE_NAME}`);
  console.log(JSON.stringify(counts));
  await client.close();
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
