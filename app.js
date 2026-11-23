const titles = {
  catalog: "Consulta de libros",
  users: "Creación de usuarios",
  loans: "Solicitud de préstamo"
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
  const response = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    </article>`).join("") : "<p>No se encontraron libros.</p>";
}

document.getElementById("searchForm").addEventListener("submit", event => {
  searchCatalog(event).catch(error => alert(error.message));
});
document.getElementById("catalogResults").innerHTML = "";
searchCatalog({ preventDefault() {} }).catch(() => {});

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
  } catch (error) { alert(error.message); }
});

const loginDialog = document.getElementById("loginDialog");
loginDialog.showModal();
document.getElementById("loginForm").addEventListener("submit", () => loginDialog.close());
document.getElementById("logoutButton").addEventListener("click", () => loginDialog.showModal());
