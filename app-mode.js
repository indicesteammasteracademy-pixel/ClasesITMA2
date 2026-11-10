/* Restricciones de interfaz para la versión móvil de ITMA Academy. */
(() => {
  if (!window.ITMA_APP_MODE) return;

  // El acceso de profesor se conserva en el navegador, pero no se ofrece dentro de la app.
  const admin = document.getElementById("admin");
  const profesor = document.getElementById("lprof");
  if (admin) {
    admin.style.setProperty("display", "none", "important");
    admin.onclick = null;
  }
  if (profesor) {
    profesor.style.setProperty("display", "none", "important");
    profesor.onclick = null;
  }

  ["panel", "panelAlumnos", "panelActividad"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.setProperty("display", "none", "important");
  });
})();
