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

test("catalog filters by title", async () => {
  const app = await createServer();
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/catalog?field=title&query=Cien`);
  const books = await response.json();
  assert.equal(response.status, 200);
  assert.equal(books.length, 1);
  assert.equal(books[0].author, "Gabriel García Márquez");
  assert.ok(books[0].total);
  assert.ok(books[0].location);
  server.close();
});

test("creates a digital member credential", async () => {
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
  assert.equal(response.status, 201);
  assert.equal(user.status, "pending");
  assert.equal(user.credentialNumber, null);
  const pending = await fetch(`http://127.0.0.1:${port}/api/users/pending`);
  assert.equal((await pending.json()).length, 1);
  const approval = await fetch(`http://127.0.0.1:${port}/api/users/${user.id}/approve`, { method: "POST" });
  const approved = await approval.json();
  assert.equal(approval.status, 200);
  assert.equal(approved.status, "approved");
  assert.match(approved.credentialNumber, /^BA-/);
  server.close();
});

test("rejects address proof that is not INE", async () => {
  const app = await createServer();
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Ana López", address: "Centro", idDocument: "INE-123", addressProofType: "recibo", addressProof: "recibo.pdf" })
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "El comprobante de domicilio debe ser una INE");
  server.close();
});

test("creates a loan request", async () => {
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
  assert.equal(response.status, 201);
  assert.equal(loan.libraryNumber, "BA-00125");
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
  assert.equal(created.errors, undefined);
  assert.equal(created.data.createBook.title, "Libro CRUD");
  const deleteResponse = await fetch(`http://127.0.0.1:${port}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation DeleteBook($id: ID!) {
        deleteBook(id: $id) { ok message }
      }`,
      variables: { id: created.data.createBook.id }
    })
  });
  const deleted = await deleteResponse.json();
  assert.equal(deleted.errors, undefined);
  assert.equal(deleted.data.deleteBook.ok, true);
  server.close();
});
