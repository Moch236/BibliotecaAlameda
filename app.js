const PAGE_SIZE = 12;
const DIRECTORY_PAGE_SIZE = 20;

const sections = {
  catalog: {
    title: "Catálogo",
    description: "Busca y administra el acervo de la biblioteca."
  },
  users: {
    title: "Usuarios",
    description: "Registra solicitudes y administra usuarios y credenciales."
  },
  loans: {
    title: "Préstamos",
    description: "Registra préstamos y da seguimiento a sus fechas y estado."
  },
  queries: {
    title: "Consultas complejas",
    description: "Explora estadísticas generadas a partir de las colecciones."
  }
};

const paginationState = {
  catalog: { offset: 0, count: 0, field: "title", query: "" },
  users: { offset: 0, count: 0, query: "" },
  loans: { offset: 0, count: 0, query: "" }
};

const records = {
  books: new Map(),
  users: new Map(),
  loans: new Map()
};

const editFields = {
  books: [
    { name: "title", label: "Título", required: true, maxLength: 200 },
    { name: "author", label: "Autor", required: true, maxLength: 160 },
    { name: "classifier", label: "Clasificador", required: true, maxLength: 80 },
    { name: "total", label: "Ejemplares", type: "number", min: 0, required: true },
    { name: "volume", label: "Volumen", maxLength: 100 },
    { name: "location", label: "Ubicación", maxLength: 120 }
  ],
  users: [
    { name: "fullName", label: "Nombre completo", required: true, maxLength: 160 },
    { name: "idDocument", label: "Documento de identificación", required: true, maxLength: 100 },
    { name: "address", label: "Domicilio", required: true, maxLength: 240, wide: true },
    { name: "postalCode", label: "Código postal", maxLength: 12 },
    { name: "phone", label: "Teléfono", type: "tel", maxLength: 30 },
    { name: "email", label: "Correo electrónico", type: "email", maxLength: 160, wide: true },
    { name: "occupation", label: "Ocupación", maxLength: 100 },
    { name: "workplace", label: "Escuela o trabajo", maxLength: 140 },
    { name: "addressProofType", label: "Tipo de comprobante", type: "select", options: ["INE"], required: true },
    { name: "addressProof", label: "Nombre del archivo de comprobante", maxLength: 240, wide: true },
    { name: "photo", label: "Nombre del archivo de fotografía", maxLength: 240, wide: true },
    { name: "emergencyContact", label: "Contacto de emergencia", maxLength: 160, wide: true }
  ],
  loans: [
    { name: "title", label: "Título del libro", required: true, maxLength: 200, wide: true },
    { name: "loanDate", label: "Fecha de préstamo", type: "date", required: true },
    { name: "returnDate", label: "Fecha de devolución", type: "date", required: true },
    { name: "libraryNumber", label: "Número de biblioteca", required: true, maxLength: 80, wide: true },
    { name: "status", label: "Estado", type: "select", options: ["active", "returned"], required: true }
  ]
};

const entityConfig = {
  books: {
    title: "libro",
    updateField: "updateBook",
    updateType: "UpdateBookInput!",
    updateSelection: "id",
    deleteField: "deleteBook",
    reload: loadCatalog
  },
  users: {
    title: "usuario",
    updateField: "updateUser",
    updateType: "UpdateUserInput!",
    updateSelection: "id",
    deleteField: "deleteUser",
    reload: () => Promise.all([loadUsers(), loadPendingUsers()])
  },
  loans: {
    title: "préstamo",
    updateField: "updateLoan",
    updateType: "UpdateLoanInput!",
    updateSelection: "id",
    deleteField: "deleteLoan",
    reload: loadLoans
  }
};

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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function showToast(message, type = "success") {
  const region = document.getElementById("toastRegion");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), 4800);
}

function setFormBusy(form, busy, busyText = "Guardando…") {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function setLoading(container, loading, message = "Cargando…") {
  container.setAttribute("aria-busy", String(loading));
  if (loading) container.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function emptyState(title, message = "") {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}</div>`;
}

function renderPagination(container, key, pageSize, count) {
  const state = paginationState[key];
  const currentPage = Math.floor(state.offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  container.innerHTML = count > pageSize ? `
    <button class="secondary" type="button" data-page-key="${key}" data-page-direction="-1" ${state.offset === 0 ? "disabled" : ""}>Anterior</button>
    <span>Página ${currentPage} de ${totalPages}</span>
    <button class="secondary" type="button" data-page-key="${key}" data-page-direction="1" ${state.offset + pageSize >= count ? "disabled" : ""}>Siguiente</button>` : "";
}

function renderStatus(status) {
  const normalized = String(status || "active").toLowerCase();
  const labels = { pending: "Pendiente", approved: "Aprobado", active: "Activo", returned: "Devuelto" };
  const css = ["pending", "approved", "active", "returned"].includes(normalized) ? `status-${normalized}` : "status-neutral";
  return `<span class="status-pill ${css}">${escapeHtml(labels[normalized] || normalized)}</span>`;
}

function renderBook(book) {
  return `
    <article class="book">
      <h3>${escapeHtml(book.title)}</h3>
      <dl class="book-meta">
        <div><dt>Autor</dt><dd>${escapeHtml(book.author)}</dd></div>
        <div><dt>Clasificador</dt><dd>${escapeHtml(book.classifier)}</dd></div>
        <div><dt>Ejemplares</dt><dd>${escapeHtml(book.total)}</dd></div>
        <div><dt>Volumen</dt><dd>${escapeHtml(book.volume || "—")}</dd></div>
        <div><dt>Ubicación</dt><dd>${escapeHtml(book.location || "—")}</dd></div>
      </dl>
      <div class="row-actions">
        <button class="secondary" type="button" data-action="edit" data-kind="books" data-id="${escapeHtml(book.id)}">Editar</button>
        <button class="danger" type="button" data-action="delete" data-kind="books" data-id="${escapeHtml(book.id)}">Eliminar</button>
      </div>
    </article>`;
}

function renderUser(user) {
  return `
    <article class="data-row">
      <div class="data-row-main">
        <strong>${escapeHtml(user.fullName)}</strong>
        <small>${escapeHtml(user.email || "Sin correo")} · ${escapeHtml(user.libraryNumber || "Sin número de biblioteca")}</small>
      </div>
      <div class="data-row-content">
        ${renderStatus(user.status)}
        <div class="row-actions">
          <button class="secondary" type="button" data-action="edit" data-kind="users" data-id="${escapeHtml(user.id)}">Editar</button>
          <button class="danger" type="button" data-action="delete" data-kind="users" data-id="${escapeHtml(user.id)}">Eliminar</button>
        </div>
      </div>
    </article>`;
}

function renderLoan(loan) {
  return `
    <article class="data-row">
      <div class="data-row-main">
        <strong>${escapeHtml(loan.title)}</strong>
        <small>${escapeHtml(loan.libraryNumber)} · ${escapeHtml(loan.loanDate)} a ${escapeHtml(loan.returnDate)}</small>
      </div>
      <div class="data-row-content">
        ${renderStatus(loan.status)}
        <div class="row-actions">
          <button class="secondary" type="button" data-action="edit" data-kind="loans" data-id="${escapeHtml(loan.id)}">Editar</button>
          <button class="danger" type="button" data-action="delete" data-kind="loans" data-id="${escapeHtml(loan.id)}">Eliminar</button>
        </div>
      </div>
    </article>`;
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
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta inválida.");
  }
  if (!response.ok || payload.errors) {
    throw new Error(payload.errors?.[0]?.message || "No fue posible completar la operación.");
  }
  return payload.data;
}

function renderCredential(user) {
  document.getElementById("credentialName").textContent = user.fullName;
  document.getElementById("credentialNumber").textContent = user.credentialNumber || "Se asignará al aprobar";
  document.getElementById("credentialAvatar").textContent = user.fullName
    .split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "BA";
  document.getElementById("credentialStatus").className = `status-pill ${user.status === "approved" ? "status-approved" : "status-pending"}`;
  document.getElementById("credentialStatus").textContent = user.status === "approved" ? "Aprobado" : "Pendiente";
  const values = [
    ["Domicilio", user.address],
    ["Código postal", user.postalCode],
    ["Teléfono", user.phone],
    ["Correo", user.email],
    ["Ocupación", user.occupation],
    ["Escuela o trabajo", user.workplace]
  ];
  document.getElementById("credentialData").innerHTML = values
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd>`)
    .join("");
}

async function loadCatalog(offset = paginationState.catalog.offset) {
  const state = paginationState.catalog;
  const container = document.getElementById("catalogResults");
  const countLabel = document.getElementById("catalogCount");
  state.offset = Math.max(offset, 0);
  state.field = document.getElementById("searchField").value;
  state.query = document.getElementById("searchQuery").value.trim();
  setLoading(container, true, "Buscando en el catálogo…");
  countLabel.textContent = "Buscando…";
  try {
    const data = await graphqlRequest(`
      query CatalogPage($field: String, $query: String, $limit: Int, $offset: Int) {
        books(field: $field, query: $query, limit: $limit, offset: $offset) {
          id title author classifier total volume location
        }
        bookCount(field: $field, query: $query)
      }`, {
      field: state.field,
      query: state.query,
      limit: PAGE_SIZE,
      offset: state.offset
    });
    const books = data.books;
    state.count = data.bookCount;
    if (state.offset > 0 && state.offset >= state.count) {
      return loadCatalog(state.count ? Math.floor((state.count - 1) / PAGE_SIZE) * PAGE_SIZE : 0);
    }
    records.books = new Map(books.map(book => [book.id, book]));
    container.innerHTML = books.length ? books.map(renderBook).join("") : emptyState(
      state.query ? "No encontramos coincidencias" : "El catálogo está vacío",
      state.query ? "Prueba con otro término o campo de búsqueda." : "Agrega un título para comenzar."
    );
    const currentPage = Math.floor(state.offset / PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil(state.count / PAGE_SIZE));
    countLabel.textContent = `${state.count} ${state.count === 1 ? "título" : "títulos"} · página ${currentPage} de ${totalPages}`;
    renderPagination(document.getElementById("catalogPagination"), "catalog", PAGE_SIZE, state.count);
    container.setAttribute("aria-busy", "false");
  } catch (error) {
    container.innerHTML = emptyState("No se pudo cargar el catálogo", error.message);
    container.setAttribute("aria-busy", "false");
    countLabel.textContent = "Error al cargar";
    throw error;
  }
}

async function loadPendingUsers() {
  const container = document.getElementById("pendingUsers");
  setLoading(container, true, "Cargando solicitudes…");
  try {
    const data = await graphqlRequest(`
      query PendingUsers {
        pendingUsers { id fullName addressProofType addressProof }
      }`);
    const users = data.pendingUsers;
    container.innerHTML = users.length ? users.map(user => `
      <article class="pending-user">
        <div class="pending-user-main">
          <strong>${escapeHtml(user.fullName)}</strong>
          <small>${escapeHtml(user.addressProofType)} · Archivo registrado: ${escapeHtml(user.addressProof)}</small>
        </div>
        <div class="row-actions">
          <button class="primary" type="button" data-action="approve-user" data-id="${escapeHtml(user.id)}">Aprobar</button>
        </div>
      </article>`).join("") : emptyState("No hay solicitudes pendientes");
    container.setAttribute("aria-busy", "false");
  } catch (error) {
    container.innerHTML = emptyState("No se pudieron cargar las solicitudes", error.message);
    container.setAttribute("aria-busy", "false");
    throw error;
  }
}

async function loadUsers(offset = paginationState.users.offset) {
  const state = paginationState.users;
  const container = document.getElementById("userList");
  state.offset = Math.max(offset, 0);
  state.query = document.getElementById("userSearch").value.trim();
  setLoading(container, true, "Cargando directorio…");
  document.getElementById("userCount").textContent = "Buscando…";
  try {
    const data = await graphqlRequest(`
      query UsersPage($limit: Int, $offset: Int, $query: String) {
        users(limit: $limit, offset: $offset, query: $query) {
          id fullName email libraryNumber status
        }
        userCount(query: $query)
      }`, { limit: DIRECTORY_PAGE_SIZE, offset: state.offset, query: state.query });
    state.count = data.userCount;
    if (state.offset > 0 && state.offset >= state.count) {
      return loadUsers(state.count ? Math.floor((state.count - 1) / DIRECTORY_PAGE_SIZE) * DIRECTORY_PAGE_SIZE : 0);
    }
    records.users = new Map(data.users.map(user => [user.id, user]));
    container.innerHTML = data.users.length ? data.users.map(renderUser).join("") : emptyState(
      state.query ? "No encontramos usuarios" : "Aún no hay usuarios registrados",
      state.query ? "Prueba con otro nombre, correo o número de biblioteca." : ""
    );
    const currentPage = Math.floor(state.offset / DIRECTORY_PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil(state.count / DIRECTORY_PAGE_SIZE));
    document.getElementById("userCount").textContent = `${state.count} ${state.count === 1 ? "registro" : "registros"} · página ${currentPage} de ${totalPages}`;
    renderPagination(document.getElementById("userPagination"), "users", DIRECTORY_PAGE_SIZE, state.count);
    container.setAttribute("aria-busy", "false");
  } catch (error) {
    container.innerHTML = emptyState("No se pudo cargar el directorio", error.message);
    container.setAttribute("aria-busy", "false");
    document.getElementById("userCount").textContent = "Error al cargar";
    throw error;
  }
}

async function loadLoans(offset = paginationState.loans.offset) {
  const state = paginationState.loans;
  const container = document.getElementById("loanList");
  state.offset = Math.max(offset, 0);
  state.query = document.getElementById("loanSearch").value.trim();
  setLoading(container, true, "Cargando préstamos…");
  document.getElementById("loanCount").textContent = "Buscando…";
  try {
    const data = await graphqlRequest(`
      query LoansPage($limit: Int, $offset: Int, $query: String) {
        loans(limit: $limit, offset: $offset, query: $query) {
          id title loanDate returnDate libraryNumber status
        }
        loanCount(query: $query)
      }`, { limit: DIRECTORY_PAGE_SIZE, offset: state.offset, query: state.query });
    state.count = data.loanCount;
    if (state.offset > 0 && state.offset >= state.count) {
      return loadLoans(state.count ? Math.floor((state.count - 1) / DIRECTORY_PAGE_SIZE) * DIRECTORY_PAGE_SIZE : 0);
    }
    records.loans = new Map(data.loans.map(loan => [loan.id, loan]));
    container.innerHTML = data.loans.length ? data.loans.map(renderLoan).join("") : emptyState(
      state.query ? "No encontramos préstamos" : "Aún no hay préstamos registrados",
      state.query ? "Prueba con otro título, número o estado." : ""
    );
    const currentPage = Math.floor(state.offset / DIRECTORY_PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil(state.count / DIRECTORY_PAGE_SIZE));
    document.getElementById("loanCount").textContent = `${state.count} ${state.count === 1 ? "registro" : "registros"} · página ${currentPage} de ${totalPages}`;
    renderPagination(document.getElementById("loanPagination"), "loans", DIRECTORY_PAGE_SIZE, state.count);
    container.setAttribute("aria-busy", "false");
  } catch (error) {
    container.innerHTML = emptyState("No se pudieron cargar los préstamos", error.message);
    container.setAttribute("aria-busy", "false");
    document.getElementById("loanCount").textContent = "Error al cargar";
    throw error;
  }
}

function createField(field, value = "") {
  const label = document.createElement("label");
  if (field.wide) label.classList.add("field-wide");
  label.append(document.createTextNode(field.label));
  let input;
  if (field.type === "select") {
    input = document.createElement("select");
    for (const optionValue of field.options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue === "active" ? "Activo"
        : optionValue === "returned" ? "Devuelto"
        : optionValue;
      input.append(option);
    }
  } else {
    input = document.createElement("input");
    input.type = field.type || "text";
    if (field.min !== undefined) input.min = String(field.min);
    if (field.maxLength) input.maxLength = field.maxLength;
  }
  input.name = field.name;
  input.value = value ?? "";
  input.required = Boolean(field.required);
  label.append(input);
  return label;
}

function openEditDialog(kind, id) {
  const record = records[kind]?.get(id);
  if (!record) {
    showToast("No encontramos el registro seleccionado. Actualiza la lista e inténtalo de nuevo.", "error");
    return;
  }
  const dialog = document.getElementById("editDialog");
  const form = document.getElementById("editForm");
  const fields = document.getElementById("editFields");
  form.dataset.kind = kind;
  form.dataset.recordId = id;
  document.getElementById("editDialogTitle").textContent = `Editar ${entityConfig[kind].title}`;
  document.getElementById("editDialogNote").hidden = kind !== "users";
  document.getElementById("editDialogNote").textContent = "Los campos de comprobante y fotografía guardan nombres de archivo; esta versión no carga el contenido de documentos.";
  fields.replaceChildren(...editFields[kind].map(field => createField(field, record[field.name])));
  dialog.showModal();
  fields.querySelector("input, select")?.focus();
}

async function deleteRecord(kind, id) {
  const config = entityConfig[kind];
  const record = records[kind]?.get(id);
  if (!config || !record) return;
  const message = kind === "users"
    ? `¿Eliminar a ${record.fullName}? Los préstamos relacionados no se eliminan automáticamente.`
    : `¿Eliminar ${kind === "books" ? `«${record.title}»` : `el préstamo «${record.title}»`}?`;
  if (!window.confirm(message)) return;
  try {
    const data = await graphqlRequest(`
      mutation DeleteRecord($id: ID!) {
        ${config.deleteField}(id: $id) { ok message }
      }`, { id });
    const result = data[config.deleteField];
    if (!result.ok) throw new Error(result.message || "No se pudo eliminar el registro.");
    showToast(`${config.title[0].toUpperCase()}${config.title.slice(1)} eliminado.`);
    await config.reload();
  } catch (error) {
    showToast(error.message, "error");
  }
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const selected = button.dataset.section;
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item === button);
      if (item === button) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    document.querySelectorAll(".view").forEach(view => {
      const active = view.id === selected;
      view.classList.toggle("active", active);
      view.hidden = !active;
    });
    document.getElementById("pageTitle").textContent = sections[selected].title;
    document.getElementById("pageDescription").textContent = sections[selected].description;
  });
});

document.getElementById("searchForm").addEventListener("submit", event => {
  event.preventDefault();
  loadCatalog(0).catch(error => showToast(error.message, "error"));
});

document.getElementById("bookForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const input = Object.fromEntries(new FormData(form));
  input.total = Number(input.total);
  setFormBusy(form, true, "Guardando…");
  try {
    await graphqlRequest(`
      mutation CreateBook($input: BookInput!) {
        createBook(input: $input) { id title }
      }`, { input });
    form.reset();
    form.elements.total.value = "1";
    document.querySelector(".create-panel").open = false;
    paginationState.catalog.field = "title";
    paginationState.catalog.query = "";
    document.getElementById("searchField").value = "title";
    document.getElementById("searchQuery").value = "";
    await loadCatalog(0);
    showToast("Libro agregado al catálogo.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setFormBusy(form, false);
  }
});

document.getElementById("userForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const input = Object.fromEntries(formData);
  input.addressProof = formData.get("addressProof")?.name || "";
  input.photo = formData.get("photo")?.name || "";
  if (!input.addressProof) {
    showToast("Selecciona el archivo del comprobante para registrar su nombre.", "error");
    return;
  }
  setFormBusy(form, true, "Registrando…");
  try {
    const data = await graphqlRequest(`
      mutation CreateUser($input: UserInput!) {
        createUser(input: $input) {
          id fullName address postalCode phone email occupation workplace status credentialNumber
        }
      }`, { input });
    form.reset();
    renderCredential(data.createUser);
    await Promise.all([loadPendingUsers(), loadUsers()]);
    showToast("Solicitud de usuario registrada.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setFormBusy(form, false);
  }
});

document.getElementById("refreshPending").addEventListener("click", () => {
  loadPendingUsers().catch(error => showToast(error.message, "error"));
});

document.getElementById("userSearchForm").addEventListener("submit", event => {
  event.preventDefault();
  loadUsers(0).catch(error => showToast(error.message, "error"));
});

document.getElementById("loanSearchForm").addEventListener("submit", event => {
  event.preventDefault();
  loadLoans(0).catch(error => showToast(error.message, "error"));
});

document.getElementById("loanForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const input = Object.fromEntries(new FormData(form));
  if (input.returnDate < input.loanDate) {
    showToast("La fecha de devolución no puede ser anterior a la fecha del préstamo.", "error");
    return;
  }
  setFormBusy(form, true, "Creando…");
  try {
    const data = await graphqlRequest(`
      mutation CreateLoan($input: LoanInput!) {
        createLoan(input: $input) {
          id title loanDate returnDate libraryNumber status
        }
      }`, { input });
    const loan = data.createLoan;
    document.getElementById("loanResult").textContent =
      `Préstamo registrado: «${loan.title}», ${loan.loanDate} a ${loan.returnDate}.`;
    form.reset();
    await loadLoans(0);
    showToast("Préstamo registrado.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setFormBusy(form, false);
  }
});

document.addEventListener("click", async event => {
  const paginationButton = event.target.closest("[data-page-key]");
  if (paginationButton) {
    const key = paginationButton.dataset.pageKey;
    const pageSize = key === "catalog" ? PAGE_SIZE : DIRECTORY_PAGE_SIZE;
    const nextOffset = paginationState[key].offset + Number(paginationButton.dataset.pageDirection) * pageSize;
    const loaders = { catalog: loadCatalog, users: loadUsers, loans: loadLoans };
    loaders[key](nextOffset).catch(error => showToast(error.message, "error"));
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit") openEditDialog(button.dataset.kind, button.dataset.id);
  if (button.dataset.action === "delete") await deleteRecord(button.dataset.kind, button.dataset.id);
  if (button.dataset.action === "approve-user") {
    button.disabled = true;
    try {
      const data = await graphqlRequest(`
        mutation ApproveUser($id: ID!) {
          approveUser(id: $id) { id status credentialNumber }
        }`, { id: button.dataset.id });
      await Promise.all([loadPendingUsers(), loadUsers(), loadLoanSuggestions()]);
      showToast(`Solicitud aprobada. Credencial: ${data.approveUser.credentialNumber}`);
    } catch (error) {
      button.disabled = false;
      showToast(error.message, "error");
    }
  }
});

document.getElementById("editForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const kind = form.dataset.kind;
  const config = entityConfig[kind];
  const input = Object.fromEntries(new FormData(form));
  if (kind === "books") input.total = Number(input.total);
  if (kind === "loans" && input.returnDate < input.loanDate) {
    showToast("La fecha de devolución no puede ser anterior a la fecha del préstamo.", "error");
    return;
  }
  setFormBusy(form, true, "Guardando…");
  try {
    await graphqlRequest(`
      mutation UpdateRecord($id: ID!, $input: ${config.updateType}) {
        ${config.updateField}(id: $id, input: $input) { ${config.updateSelection} }
      }`, { id: form.dataset.recordId, input });
    document.getElementById("editDialog").close();
    showToast(`${config.title[0].toUpperCase()}${config.title.slice(1)} actualizado.`);
    await config.reload();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setFormBusy(form, false);
  }
});

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => document.getElementById("editDialog").close());
});

document.getElementById("editDialog").addEventListener("click", event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

document.getElementById("editDialog").addEventListener("close", () => {
  const form = document.getElementById("editForm");
  form.reset();
  delete form.dataset.kind;
  delete form.dataset.recordId;
});

function renderComplexQueryGroups() {
  Object.entries(complexQueries).forEach(([owner, queries]) => {
    const container = document.getElementById(`${owner}Queries`);
    container.innerHTML = queries.map(([label, field]) => `
      <button class="query-button" type="button" data-query-field="${field}" data-query-label="${escapeHtml(label)}">
        ${escapeHtml(label)}
      </button>`).join("");
  });
}

async function runComplexQuery(field, label, activeButton) {
  document.querySelectorAll(".query-button").forEach(button => button.removeAttribute("aria-current"));
  activeButton?.setAttribute("aria-current", "true");
  document.getElementById("queryResultTitle").textContent = label;
  document.getElementById("queryResultHelp").textContent = "Ejecutando agregación en MongoDB…";
  const container = document.getElementById("complexQueryResults");
  setLoading(container, true, "Consultando datos…");
  try {
    const data = await graphqlRequest(`query ComplexQuery { ${field} { label value count details } }`);
    const rows = data[field];
    container.innerHTML = rows.length ? rows.map(row => `
      <article class="data-row">
        <div class="data-row-main"><strong>${escapeHtml(row.label)}</strong><small>${escapeHtml(row.details || "")}</small></div>
        <div><strong>${escapeHtml(row.value)}</strong><small>${escapeHtml(row.count)} registros</small></div>
      </article>`).join("") : emptyState("La consulta no produjo resultados", "Comprueba la conexión y los datos disponibles.");
    document.getElementById("queryResultHelp").textContent = `${rows.length} grupos de resultados devueltos por la consulta.`;
    container.setAttribute("aria-busy", "false");
  } catch (error) {
    container.innerHTML = emptyState("No se pudo ejecutar la consulta", error.message);
    document.getElementById("queryResultHelp").textContent = "Revisa la conexión al servicio y vuelve a intentarlo.";
    container.setAttribute("aria-busy", "false");
  }
}

document.getElementById("queries").addEventListener("click", event => {
  const button = event.target.closest("[data-query-field]");
  if (button) runComplexQuery(button.dataset.queryField, button.dataset.queryLabel, button);
});

async function loadLoanSuggestions() {
  try {
    const [bookData, userData] = await Promise.all([
      graphqlRequest(`query BookSuggestions { books(limit: 100) { title } }`),
      graphqlRequest(`query UserSuggestions { users(limit: 100) { libraryNumber } }`)
    ]);
    document.getElementById("bookSuggestions").innerHTML = bookData.books
      .map(book => `<option value="${escapeHtml(book.title)}"></option>`).join("");
    document.getElementById("userSuggestions").innerHTML = [...new Set(userData.users.map(user => user.libraryNumber).filter(Boolean))]
      .map(number => `<option value="${escapeHtml(number)}"></option>`).join("");
  } catch (error) {
    showToast(`No se pudieron cargar sugerencias: ${error.message}`, "error");
  }
}

async function refreshAuthStatus() {
  const response = await fetch("/api/auth/status");
  if (!response.ok) throw new Error("No se pudo verificar la sesión.");
  const status = await response.json();
  const button = document.getElementById("logoutButton");
  button.textContent = status.ok ? `Salir · ${status.username}` : "Iniciar sesión";
  button.setAttribute("aria-label", status.ok ? `Cerrar sesión de ${status.username}` : "Iniciar sesión de administrador");
  if (!status.ok && !loginDialog.open) loginDialog.showModal();
  return status;
}

const loginDialog = document.getElementById("loginDialog");
document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const credentials = Object.fromEntries(new FormData(form));
  setFormBusy(form, true, "Verificando…");
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No fue posible iniciar sesión.");
    if (data.token) localStorage.setItem("biblioteca_token", data.token);
    form.reset();
    loginDialog.close();
    await refreshAuthStatus();
    showToast("Sesión iniciada.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setFormBusy(form, false);
  }
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    const status = await refreshAuthStatus();
    if (!status.ok) return;
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("No fue posible cerrar la sesión.");
    localStorage.removeItem("biblioteca_token");
    await refreshAuthStatus();
    showToast("Sesión cerrada.");
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.getElementById("loanForm").elements.loanDate.addEventListener("change", event => {
  document.getElementById("loanForm").elements.returnDate.min = event.currentTarget.value;
});

document.getElementById("editFields").addEventListener("change", event => {
  if (event.target.name === "loanDate") {
    const returnDate = document.querySelector('#editFields [name="returnDate"]');
    if (returnDate) returnDate.min = event.target.value;
  }
});

function initialize() {
  renderComplexQueryGroups();
  loadCatalog().catch(error => showToast(error.message, "error"));
  loadPendingUsers().catch(error => showToast(error.message, "error"));
  loadUsers().catch(error => showToast(error.message, "error"));
  loadLoans().catch(error => showToast(error.message, "error"));
  loadLoanSuggestions();
  refreshAuthStatus().catch(error => {
    showToast(error.message, "error");
    if (!loginDialog.open) loginDialog.showModal();
  });
}

initialize();
