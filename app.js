const titles = {
  catalog: "Consulta de libros",
  users: "Creación de usuarios",
  loans: "Solicitud de préstamo",
  database: "Conexión con MongoDB"
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

async function searchCatalog(event) {
  event.preventDefault();
  const field = document.getElementById("searchField").value;
  const query = document.getElementById("searchQuery").value;
  const books = await jsonRequest(`/api/catalog?field=${encodeURIComponent(field)}&query=${encodeURIComponent(query)}`);
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
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const user = await jsonRequest("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    });
    document.getElementById("credentialName").textContent = user.fullName;
    document.getElementById("credentialNumber").textContent = user.credentialNumber;
    document.getElementById("credentialData").innerHTML =
      `<dt>Domicilio</dt><dd>${user.address}</dd><dt>Código Postal</dt><dd>${user.postalCode || "—"}</dd>` +
      `<dt>Teléfono</dt><dd>${user.phone || "—"}</dd><dt>Correo</dt><dd>${user.email || "—"}</dd>` +
      `<dt>Ocupación</dt><dd>${user.occupation || "—"}</dd><dt>Escuela o Trabajo</dt><dd>${user.workplace || "—"}</dd>`;
  } catch (error) { alert(error.message); }
});

document.getElementById("loanForm").addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const loan = await jsonRequest("/api/loans", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    });
    document.getElementById("loanResult").textContent =
      `Solicitud ${loan.id.slice(0, 8)} generada: «${loan.title}», préstamo ${loan.loanDate}, retorno ${loan.returnDate}, número ${loan.libraryNumber}.`;
  } catch (error) { alert(error.message); }
});

document.getElementById("mongoForm").addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result = await jsonRequest("/api/mongo/connect", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    });
    document.getElementById("mongoStatus").textContent = `Conectado correctamente a ${result.database}.`;
  } catch (error) { document.getElementById("mongoStatus").textContent = `Error: ${error.message}`; }
});

const loginDialog = document.getElementById("loginDialog");
loginDialog.showModal();
document.getElementById("loginForm").addEventListener("submit", () => loginDialog.close());
document.getElementById("logoutButton").addEventListener("click", () => loginDialog.showModal());
