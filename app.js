const titles = {
  catalog: "Consulta de libros",
  users: "Creación de usuarios",
  loans: "Solicitud de préstamo",
  queries: "Consultas supercomplejas"
};

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.section).classList.add("active");
    document.getElementById("pageTitle").textContent = titles[button.dataset.section];
  });
});

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No fue posible completar la operación");
  return data;
}

async function graphqlRequest(query, variables = {}) {
  const token = localStorage.getItem("biblioteca_token");
  const response = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await response.json();
  if (!response.ok || data.errors) {
    throw new Error(data.errors?.[0]?.message || "No fue posible completar la operación");
  }
  return data.data;
}

async function searchCatalog(event) {
  event.preventDefault();
  const field = document.getElementById("searchField").value;
  const query = document.getElementById("searchQuery").value;
  const data = await graphqlRequest(`
    query Catalog($field: String, $query: String) {
      books(field: $field, query: $query) {
        id title author classifier total volume location
      }
    }`, { field, query });
  const books = data.books;
  const container = document.getElementById("catalogResults");
  container.innerHTML = books.length ? books.map(book => `
    <article class="book">
      <h3>${book.title}</h3>
      <p><strong>Autor:</strong> ${book.author}</p>
      <p><strong>Clasificador:</strong> ${book.classifier}</p>
      <p><strong>Total de ejemplares:</strong> ${book.total}</p>
      <p><strong>Volumen:</strong> ${book.volume}</p>
      <p><strong>Ubicación:</strong> ${book.location}</p>
      <div class="row-actions">
        <button class="secondary edit-book" type="button" data-book-id="${book.id}">Editar</button>
        <button class="danger delete-book" type="button" data-book-id="${book.id}">Eliminar</button>
      </div>
    </article>`).join("") : "<p>No se encontraron libros.</p>";
  container.querySelectorAll(".edit-book").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.bookId;
      const article = button.closest(".book");
      const title = prompt("Título", article.querySelector("h3").textContent);
      if (!title) return;
      const author = prompt("Autor", article.children[1].textContent.replace("Autor:", "").trim());
      if (!author) return;
      try {
        await graphqlRequest(`mutation UpdateBook($id: ID!, $input: UpdateBookInput!) { updateBook(id: $id, input: $input) { id } }`, {
          id, input: { title, author }
        });
        await searchCatalog({ preventDefault() {} });
      } catch (error) { alert(error.message); }
    });
  });
  container.querySelectorAll(".delete-book").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este libro del catálogo?")) return;
      try {
        await graphqlRequest(`mutation DeleteBook($id: ID!) { deleteBook(id: $id) { ok message } }`, { id: button.dataset.bookId });
        await searchCatalog({ preventDefault() {} });
      } catch (error) { alert(error.message); }
    });
  });
}

document.getElementById("searchForm").addEventListener("submit", event => {
  searchCatalog(event).catch(error => alert(error.message));
});
document.getElementById("catalogResults").innerHTML = "";
searchCatalog({ preventDefault() {} }).catch(() => {});

document.getElementById("bookForm").addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  data.total = Number(data.total);
  try {
    await graphqlRequest(`
      mutation CreateBook($input: BookInput!) {
        createBook(input: $input) { id title }
      }`, { input: data });
    event.currentTarget.reset();
    await searchCatalog({ preventDefault() {} });
  } catch (error) { alert(error.message); }
});

document.getElementById("userForm").addEventListener("submit", async event => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const data = Object.fromEntries(formData);
  data.addressProof = formData.get("addressProof")?.name || "";
  data.photo = formData.get("photo")?.name || "";
  if (data.addressProofType !== "INE") {
    alert("El comprobante de domicilio debe ser una INE.");
    return;
  }
  if (!data.addressProof) {
    alert("Adjunte el archivo del comprobante INE.");
    return;
  }
  try {
    const result = await graphqlRequest(`
      mutation CreateUser($input: UserInput!) {
        createUser(input: $input) {
          id fullName address postalCode phone email occupation workplace status credentialNumber
        }
      }`, { input: data });
    const user = result.createUser;
    document.getElementById("credentialName").textContent = user.fullName;
    document.getElementById("credentialNumber").textContent = "Pendiente";
    document.getElementById("credentialData").innerHTML =
      `<dt>Domicilio</dt><dd>${user.address}</dd><dt>Código Postal</dt><dd>${user.postalCode || "—"}</dd>` +
      `<dt>Teléfono</dt><dd>${user.phone || "—"}</dd><dt>Correo</dt><dd>${user.email || "—"}</dd>` +
      `<dt>Ocupación</dt><dd>${user.occupation || "—"}</dd><dt>Escuela o Trabajo</dt><dd>${user.workplace || "—"}</dd>`;
    document.getElementById("credentialData").insertAdjacentHTML("beforeend", "<dt>Estado</dt><dd>Esperando aprobación de administrador</dd>");
    await loadPendingUsers();
  } catch (error) { alert(error.message); }
});

async function loadPendingUsers() {
  const container = document.getElementById("pendingUsers");
  const data = await graphqlRequest(`
    query PendingUsers {
      pendingUsers {
        id fullName addressProofType addressProof
      }
    }`);
  const users = data.pendingUsers;
  container.innerHTML = users.length ? users.map(user => `
    <article class="pending-user">
      <div><strong>${user.fullName}</strong><small>${user.addressProofType} - ${user.addressProof}</small></div>
      <button class="primary approve-user" type="button" data-user-id="${user.id}">Aprobar</button>
    </article>`).join("") : "<p>No hay solicitudes pendientes.</p>";
  container.querySelectorAll(".approve-user").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        await graphqlRequest(`
          mutation ApproveUser($id: ID!) {
            approveUser(id: $id) {
              id status credentialNumber
            }
          }`, { id: button.dataset.userId });
        await loadPendingUsers();
      } catch (error) { alert(error.message); }
    });
  });
}

loadPendingUsers().catch(error => {
  document.getElementById("pendingUsers").textContent = error.message;
});

async function loadUsers() {
  const data = await graphqlRequest(`
    query Users {
      users(limit: 100) {
        id fullName email address status credentialNumber
      }
    }`);
  const container = document.getElementById("userList");
  container.innerHTML = data.users.length ? data.users.map(user => `
    <article class="data-row">
      <div><strong>${user.fullName}</strong><small>${user.email || "Sin correo"} - ${user.status}</small></div>
      <div class="row-actions">
        <button class="secondary edit-user" type="button" data-user-id="${user.id}">Editar</button>
        <button class="danger delete-user" type="button" data-user-id="${user.id}">Eliminar</button>
      </div>
    </article>`).join("") : "<p>No hay usuarios registrados.</p>";
  container.querySelectorAll(".edit-user").forEach(button => {
    button.addEventListener("click", async () => {
      const fullName = prompt("Nombre completo");
      if (!fullName) return;
      try {
        await graphqlRequest(`mutation UpdateUser($id: ID!, $input: UpdateUserInput!) { updateUser(id: $id, input: $input) { id } }`, {
          id: button.dataset.userId, input: { fullName }
        });
        await Promise.all([loadUsers(), loadPendingUsers()]);
      } catch (error) { alert(error.message); }
    });
  });
  container.querySelectorAll(".delete-user").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este usuario?")) return;
      try {
        await graphqlRequest(`mutation DeleteUser($id: ID!) { deleteUser(id: $id) { ok message } }`, { id: button.dataset.userId });
        await Promise.all([loadUsers(), loadPendingUsers()]);
      } catch (error) { alert(error.message); }
    });
  });
}

loadUsers().catch(error => {
  document.getElementById("userList").textContent = error.message;
});

document.getElementById("loanForm").addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result = await graphqlRequest(`
      mutation CreateLoan($input: LoanInput!) {
        createLoan(input: $input) {
          id title loanDate returnDate libraryNumber
        }
      }`, { input: data });
    const loan = result.createLoan;
    document.getElementById("loanResult").textContent =
      `Solicitud ${loan.id.slice(0, 8)} generada: «${loan.title}», préstamo ${loan.loanDate}, retorno ${loan.returnDate}, número ${loan.libraryNumber}.`;
    event.currentTarget.reset();
    await loadLoans();
  } catch (error) { alert(error.message); }
});

async function loadLoans() {
  const data = await graphqlRequest(`
    query Loans {
      loans(limit: 100) {
        id title loanDate returnDate libraryNumber status
      }
    }`);
  const container = document.getElementById("loanList");
  container.innerHTML = data.loans.length ? data.loans.map(loan => `
    <article class="data-row">
      <div><strong>${loan.title}</strong><small>${loan.libraryNumber} - ${loan.status || "active"} - ${loan.loanDate} a ${loan.returnDate}</small></div>
      <div class="row-actions">
        <button class="secondary edit-loan" type="button" data-loan-id="${loan.id}">Editar</button>
        <button class="danger delete-loan" type="button" data-loan-id="${loan.id}">Eliminar</button>
      </div>
    </article>`).join("") : "<p>No hay préstamos registrados.</p>";
  container.querySelectorAll(".edit-loan").forEach(button => {
    button.addEventListener("click", async () => {
      const status = prompt("Estado (active, returned)", "returned");
      if (!status) return;
      try {
        await graphqlRequest(`mutation UpdateLoan($id: ID!, $input: UpdateLoanInput!) { updateLoan(id: $id, input: $input) { id } }`, {
          id: button.dataset.loanId, input: { status }
        });
        await loadLoans();
      } catch (error) { alert(error.message); }
    });
  });
  container.querySelectorAll(".delete-loan").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este préstamo?")) return;
      try {
        await graphqlRequest(`mutation DeleteLoan($id: ID!) { deleteLoan(id: $id) { ok message } }`, { id: button.dataset.loanId });
        await loadLoans();
      } catch (error) { alert(error.message); }
    });
  });
}

loadLoans().catch(error => {
  document.getElementById("loanList").textContent = error.message;
});

const complexQueries = {
  karla: [
    ["Usuarios por estado", "karlaUsersByStatus"],
    ["Usuarios por ocupación", "karlaUsersByOccupation"],
    ["Usuarios por código postal", "karlaUsersByPostalCode"],
    ["Pendientes por ocupación", "karlaPendingUsersByOccupation"],
    ["Aprobados por lugar de trabajo", "karlaApprovedUsersByWorkplace"],
    ["Nombres completos duplicados", "karlaDuplicateFullNames"],
    ["Credenciales por código postal", "karlaCredentialUsersByPostalCode"],
    ["Usuarios sin teléfono", "karlaUsersWithoutPhone"],
    ["Usuarios por postal y ocupación", "karlaUsersByPostalAndOccupation"],
    ["Usuarios con préstamos por estado", "karlaUsersWithLoansByStatus"]
  ],
  francisco: [
    ["Préstamos por estado", "franciscoLoansByStatus"],
    ["Préstamos por mes", "franciscoLoansByMonth"],
    ["Libros más prestados", "franciscoTopBorrowedBooks"],
    ["Lectores más activos", "franciscoMostActiveBorrowers"],
    ["Préstamos activos vencidos", "franciscoOverdueActiveLoans"],
    ["Préstamos por mes de retorno", "franciscoLoansByReturnMonth"],
    ["Duración promedio mensual", "franciscoAverageDurationByMonth"],
    ["Estado por lector", "franciscoLoanStatusByBorrower"],
    ["Tasa mensual de devolución", "franciscoReturnedRateByMonth"],
    ["Tarjetas con más préstamos", "franciscoTopLibraryNumbers"]
  ],
  saul: [
    ["Autores con mayor colección", "saulTopAuthors"],
    ["Libros por ubicación", "saulBooksByLocationPrefix"],
    ["Libros por volumen", "saulBooksByVolume"],
    ["Libros por disponibilidad", "saulBooksByAvailability"],
    ["Libros por rango clasificador", "saulBooksByClassifierRange"],
    ["Ubicaciones con mayor stock", "saulLocationsWithHighestStock"],
    ["Matriz autor-ubicación", "saulAuthorLocationMatrix"],
    ["Clasificadores principales", "saulTopClassifiers"],
    ["Distribución por materia", "saulSubjectDistribution"],
    ["Autores con baja disponibilidad", "saulAuthorsWithLowAvailability"]
  ]
};

async function runComplexQuery(field, label) {
  document.getElementById("queryResultTitle").textContent = label;
  const container = document.getElementById("complexQueryResults");
  container.textContent = "Ejecutando consulta...";
  try {
    const data = await graphqlRequest(`query ComplexQuery {
      ${field} { label value count details }
    }`);
    const rows = data[field];
    container.innerHTML = rows.length ? rows.map(row => `
      <article class="data-row">
        <div><strong>${row.label}</strong><small>${row.details || ""}</small></div>
        <div><strong>${row.value}</strong><small>${row.count} registros</small></div>
      </article>`).join("") : "<p>La consulta no produjo resultados.</p>";
  } catch (error) {
    container.textContent = error.message;
  }
}

Object.entries(complexQueries).forEach(([owner, queries]) => {
  const container = document.getElementById(`${owner}Queries`);
  container.innerHTML = queries.map(([label, field]) => `
    <button class="query-button" type="button" data-field="${field}" data-label="${label}">
      ${label}
    </button>`).join("");
  container.querySelectorAll(".query-button").forEach(button => {
    button.addEventListener("click", () => runComplexQuery(button.dataset.field, button.dataset.label));
  });
});

const loginDialog = document.getElementById("loginDialog");
async function refreshAuthStatus() {
  const response = await fetch("/api/auth/status");
  const status = await response.json();
  document.getElementById("logoutButton").textContent =
    status.ok ? `Salir (${status.username})` : "Iniciar sesión";
  if (!status.ok) loginDialog.showModal();
  return status;
}

document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No fue posible iniciar sesión");
    if (data.token) localStorage.setItem("biblioteca_token", data.token);
    loginDialog.close();
    await refreshAuthStatus();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  const status = await refreshAuthStatus();
  if (!status.ok) return;
  await fetch("/api/auth/logout", { method: "POST" });
  localStorage.removeItem("biblioteca_token");
  await refreshAuthStatus();
});

refreshAuthStatus().catch(() => loginDialog.showModal());
