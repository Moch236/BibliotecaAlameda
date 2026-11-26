const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createServer } = require("../server");

async function withServer(run) {
  const app = await createServer();
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(baseUrl);
  } finally {
    try {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    } finally {
      await app.locals.apolloServer.stop();
    }
  }
}

function createTestToken(secret) {
  const payload = Buffer.from(JSON.stringify({
    username: "test-admin",
    role: "admin",
    expiresAt: Date.now() + 60_000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function createRegistrationForm(proofBytes = Buffer.from("%PDF-1.7\n"), mimeType = "application/pdf") {
  const form = new FormData();
  form.set("fullName", "Ana López");
  form.set("idDocument", "INE-123");
  form.set("address", "Centro");
  form.set("addressProofType", "INE");
  form.set("addressProof", new Blob([proofBytes], { type: mimeType }), "ine.pdf");
  return form;
}

test("catalog is available through GraphQL", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/graphql`, {
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
  });
});

test("requires an admin session and an available database to register users", async () => {
  await withServer(async baseUrl => {
    const anonymous = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      body: createRegistrationForm()
    });
    assert.equal(anonymous.status, 401);

    const previousSecret = process.env.SESSION_SECRET;
    const secret = "registration-test-signing-secret";
    process.env.SESSION_SECRET = secret;
    try {
      const authenticated = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: { Cookie: `biblioteca_token=${createTestToken(secret)}` },
        body: createRegistrationForm()
      });
      assert.equal(authenticated.status, 503);
      assert.equal((await authenticated.json()).error, "MongoDB no está disponible");

      const invalidSignature = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: { Cookie: `biblioteca_token=${createTestToken(secret)}` },
        body: createRegistrationForm(Buffer.from("not actually a PDF"))
      });
      assert.equal(invalidSignature.status, 400);
      assert.match((await invalidSignature.json()).error, /formato permitido/);

      const invalidMime = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: { Cookie: `biblioteca_token=${createTestToken(secret)}` },
        body: createRegistrationForm(Buffer.from("%PDF-1.7\n"), "text/plain")
      });
      assert.equal(invalidMime.status, 400);

      const oversized = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: { Cookie: `biblioteca_token=${createTestToken(secret)}` },
        body: createRegistrationForm(Buffer.alloc(5 * 1024 * 1024 + 1))
      });
      assert.equal(oversized.status, 413);
    } finally {
      if (previousSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousSecret;
    }
  });
});

test("protects document downloads and exposes only the intended user-file schema", async () => {
  await withServer(async baseUrl => {
    const download = await fetch(`${baseUrl}/api/users/user-id/documents/addressProof`);
    assert.equal(download.status, 401);

    const response = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query {
          mutationFields: __type(name: "Mutation") { fields { name } }
          userFields: __type(name: "User") { fields { name } }
        }`
      })
    });
    const result = await response.json();
    assert.equal(result.errors, undefined);
    const mutations = result.data.mutationFields.fields.map(field => field.name);
    const userFields = result.data.userFields.fields.map(field => field.name);
    assert.equal(mutations.includes("createUser"), false);
    assert.equal(userFields.includes("hasAddressProof"), true);
    assert.equal(userFields.includes("hasPhoto"), true);
    assert.equal(userFields.includes("addressProofFileId"), false);
  });
});

test("rejects legacy REST loan mutation", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/loans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Pedro Páramo", loanDate: "2026-11-22", returnDate: "2026-12-06", libraryNumber: "BA-00125" })
    });
    const loan = await response.json();
    assert.equal(response.status, 404);
    assert.equal(loan.error, "Ruta no encontrada");
  });
});

test("supports book create and delete through GraphQL", async () => {
  await withServer(async baseUrl => {
    const createResponse = await fetch(`${baseUrl}/graphql`, {
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
  });
});

test("exposes thirty complex member queries", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/graphql`, {
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
  });
});

test("supports filtered and paginated catalog queries", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query {
          books(field: "author", query: "Juan", limit: 1, offset: 0) { title author }
          nextBookPage: books(limit: 1, offset: 1) { title }
          bookCount(field: "author", query: "Juan")
          noRegexInjection: bookCount(field: "title", query: "[")
        }`
      })
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.errors, undefined);
    assert.equal(result.data.bookCount, 1);
    assert.equal(result.data.noRegexInjection, 0);
    assert.equal(result.data.books.length, 1);
    assert.equal(result.data.books[0].title, "Pedro Páramo");
    assert.equal(result.data.nextBookPage[0].title, "El laberinto de la soledad");
  });
});

test("redirects unauthenticated visitors to the dedicated login page", async () => {
  await withServer(async baseUrl => {
    for (const route of ["/", "/index.html"]) {
      const dashboard = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
      assert.equal(dashboard.status, 302);
      assert.equal(dashboard.headers.get("location"), "/login");
    }

    const login = await fetch(`${baseUrl}/login`);
    assert.equal(login.status, 200);
    assert.match(await login.text(), /id="loginForm"/);

    const sourceFile = await fetch(`${baseUrl}/server.js`);
    assert.equal(sourceFile.status, 404);
    const environmentFile = await fetch(`${baseUrl}/.env`);
    assert.equal(environmentFile.status, 404);
  });
});

test("reports MongoDB disconnection to the deployment readiness check", async () => {
  await withServer(async baseUrl => {
    const readiness = await fetch(`${baseUrl}/api/mongo/status`);
    assert.equal(readiness.status, 503);
    assert.deepEqual(await readiness.json(), { connected: false, database: null });

    const liveness = await fetch(`${baseUrl}/health`);
    assert.equal(liveness.status, 200);
    assert.equal((await liveness.json()).ok, true);
  });
});

test("requires admin auth for private GraphQL reads and pending REST data", async () => {
  await withServer(async baseUrl => {
    const privateQueries = [
      "users { id }",
      "pendingUsers { id }",
      "loans { id }",
      "userCount",
      "loanCount",
      "karlaUsersByStatus { label }"
    ];
    for (const fields of privateQueries) {
      const response = await fetch(`${baseUrl}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query { ${fields} }` })
      });
      const result = await response.json();
      assert.equal(result.errors[0].message, "Se requiere una sesión de administrador");
      assert.equal(result.data, null);
    }

    const pending = await fetch(`${baseUrl}/api/users/pending`);
    assert.equal(pending.status, 401);
    assert.equal((await pending.json()).error, "Se requiere una sesión de administrador");
  });
});

test("accepts the HttpOnly admin cookie and serves the protected dashboard", async () => {
  const previousSecret = process.env.SESSION_SECRET;
  const secret = "test-only-signing-secret";
  process.env.SESSION_SECRET = secret;
  try {
    await withServer(async baseUrl => {
      const cookie = `biblioteca_token=${createTestToken(secret)}`;
      const dashboard = await fetch(baseUrl, { headers: { Cookie: cookie } });
      assert.equal(dashboard.status, 200);
      assert.match(await dashboard.text(), /Usuarios de la biblioteca/);

      const status = await fetch(`${baseUrl}/api/auth/status`, { headers: { Cookie: cookie } });
      assert.deepEqual(await status.json(), { ok: true, username: "test-admin", role: "admin" });

      const graphqlStatus = await fetch(`${baseUrl}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ query: "query { authStatus { ok username role } }" })
      });
      assert.deepEqual((await graphqlStatus.json()).data.authStatus, {
        ok: true,
        username: "test-admin",
        role: "admin"
      });

      const users = await fetch(`${baseUrl}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ query: "query { users { id } }" })
      });
      assert.equal((await users.json()).errors, undefined);
    });
  } finally {
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
});

test("clears the auth cookie on logout and does not return tokens in login responses", async () => {
  await withServer(async baseUrl => {
    const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie"), /HttpOnly/);
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);

    const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null"
    });
    assert.equal(invalidLogin.status, 400);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "example" })
    });
    assert.equal(login.status, 503);
    assert.equal("token" in await login.json(), false);
  });
});
