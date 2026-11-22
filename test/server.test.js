const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../server");

test("catalog filters by title", async () => {
  const server = createServer().listen(0);
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
  const server = createServer().listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Ana López", address: "Centro", idDocument: "INE-123" })
  });
  const user = await response.json();
  assert.equal(response.status, 201);
  assert.match(user.credentialNumber, /^BA-/);
  server.close();
});

test("creates a loan request", async () => {
  const server = createServer().listen(0);
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
