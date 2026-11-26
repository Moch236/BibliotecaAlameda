const form = document.getElementById("loginForm");
const errorMessage = document.getElementById("loginError");

function showLoginError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

async function checkExistingSession() {
  try {
    const response = await fetch("/api/auth/status");
    if (!response.ok) throw new Error("No se pudo verificar la sesión.");
    const status = await response.json();
    if (status.ok) window.location.replace("/");
  } catch {
    showLoginError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Verificando…";
  errorMessage.hidden = true;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No fue posible iniciar sesión.");
    window.location.replace("/");
  } catch (error) {
    showLoginError(error instanceof TypeError
      ? "No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo."
      : error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Iniciar sesión";
  }
});

checkExistingSession();
