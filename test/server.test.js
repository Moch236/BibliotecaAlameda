const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../server");

test("catalog is available through GraphQL", async () => {
  const app = await createServer();
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "query { books(field: \"title\", query: \"Cien\") { title author total location } }"
    })
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.errors, undefined);
  assert.equal(result.data.books.length, 1);
  assert.equal(result.data.books[0].author, "Gabriel García Márquez");
  server.close();
});

test("rejects legacy REST user mutation", async () => {
  const app = await createServer();
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Ana López", address: "Centro", idDocument: "INE-123", addressProofType: "INE", addressProof: "ine.pdf" })
  });
  const user = await response.json();
  assert.equal(response.status, 404);
  assert.equal(user.error, "Ruta no encontrada");
  server.close();
});

test("rejects legacy REST loan mutation", async () => {
  const app = await createServer();
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/loans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Pedro Páramo", loanDate: "2026-11-22", returnDate: "2026-12-06", libraryNumber: "BA-00125" })
  });
  const loan = await response.json();
  assert.equal(response.status, 404);
  assert.equal(loan.error, "Ruta no encontrada");
  server.close();
});

test("supports book create and delete through GraphQL", async () => {
  const app = await createServer();
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const createResponse = await fetch(`http://127.0.0.1:${port}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation CreateBook($input: BookInput!) {
        createBook(input: $input) { id title author }
      }`,
      variables: { input: { title: "Libro CRUD", author: "Equipo", classifier: "000 TEST", total: 2, volume: "I", location: "A-01" } }
    })
  });
  const created = await createResponse.json();
  assert.equal(created.errors[0].message, "Se requiere una sesión de administrador");
  server.close();
});

test("exposes thirty complex member queries", async () => {
  const app = await createServer();
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query { __type(name: "Query") { fields { name } } }`
    })
  });
  const result = await response.json();
  assert.equal(result.errors, undefined);
  const names = result.data.__type.fields.map(field => field.name);
  const complexNames = names.filter(name =>
    name.startsWith("karla") || name.startsWith("francisco") || name.startsWith("saul")
  );
  assert.equal(complexNames.length, 30);
  server.close();
});

test("supports filtered and paginated catalog queries", async () => {
  const app = await createServer();
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query {
        books(field: "author", query: "Juan", limit: 1, offset: 0) { title author }
        nextBookPage: books(limit: 1, offset: 1) { title }
        bookCount(field: "author", query: "Juan")
        noRegexInjection: bookCount(field: "title", query: "[")
        userCount(query: "pending")
        loanCount(query: "active")
      }`
    })
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.errors, undefined);
  assert.equal(result.data.bookCount, 1);
  assert.equal(result.data.noRegexInjection, 0);
  assert.equal(result.data.userCount, 0);
  assert.equal(result.data.loanCount, 0);
  assert.equal(result.data.books.length, 1);
  assert.equal(result.data.books[0].title, "Pedro Páramo");
  assert.equal(result.data.nextBookPage[0].title, "El laberinto de la soledad");
  server.close();
});
