  // =====================================================
  //  1) Pega aquí la URL de tu Apps Script (termina en /exec)
  //  Mientras no la pongas, se muestran las clases de ejemplo de BASE.
  // =====================================================
  const API = "https://script.google.com/macros/s/AKfycbxSyX9kdV0QF7oIuBAJk4jdSbm-7bOXDoNzJ8JkYaJfxz0EC80rBV7Szd0idy_7L_wk/exec";

  const BASE = [
    { titulo: "Introducción a los índices sintéticos", link: "https://drive.google.com/file/d/1hcZESbscxM8VJou1umkBVKk8eXv1usQn/view?usp=drive_link", locked: false },
    { titulo: "Velas japonesas y tendencias", link: "", locked: true },
    { titulo: "Boom y Crash en la práctica",  link: "", locked: true },
    { titulo: "Psicotrading",                 link: "", locked: true }
  ];

  const $ = id => document.getElementById(id);
  let clases = [];
  let clave = "";   // solo en memoria; el servidor es quien verifica la clave
  let alumno = null; // {email, code} del alumno que entró
  let vistos = new Set(); // IDs de las clases que el alumno ya vio
  let modulos = ["Clases"]; // nombres de los módulos (carpetas de Drive)
  let modAreas = [0];       // a qué área pertenece cada módulo
  let areas = ["Clases"];   // nombres de las áreas (pestañas)
  let areaActual = 0;
  let materiales = [];      // PDFs
  try { areaActual = Number(localStorage.getItem("itma_area")) || 0; } catch (e) {}
  try { alumno = JSON.parse(localStorage.getItem("itma_alumno") || "null"); } catch (e) {}
  try { clave = localStorage.getItem("itma_clave") || ""; } catch (e) {}

  function idDeDrive(link) {
    if (!link) return "";
    const m = link.match(/\/d\/([\w-]+)/) || link.match(/[?&]id=([\w-]+)/);
    return m ? m[1] : "";
  }
  const deBase = () => BASE.map(b => ({ titulo: b.titulo, id: idDeDrive(b.link), locked: b.locked, mod: 0 }));
  const hayAPI = () => API.indexOf("http") === 0;

  async function post(body) {
    // Un alumno administrador se identifica con su correo y código (rolEmail / rolCode), sin clave de profesor
    const rol = (clave === "@rol" && alumno) ? { rolEmail: alumno.email, rolCode: alumno.code } : {};
    const r = await fetch(API, { method: "POST", body: JSON.stringify({ password: clave === "@rol" ? "" : clave, ...rol, ...body }) });
    return r.json();
  }

  let tOcultar = null;
  function mostrarLogin(msg) {
    clearTimeout(tOcultar);
    const l = $("login");
    l.classList.remove("saliendo");
    l.classList.add("show");
    $("lerr").textContent = msg || "";
    if (msg) {
      const b = document.querySelector(".login-box");
      b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake");
    }
  }
  function ocultarLogin() {
    const l = $("login");
    if (!l.classList.contains("show") || l.classList.contains("saliendo")) return;
    l.classList.add("saliendo");
    tOcultar = setTimeout(() => l.classList.remove("show", "saliendo"), 450);
  }
  function actualizarQuien() {
    const q = $("quien");
    let nombre = "";
    if (clave === "@rol" && alumno) nombre = (alumno.nombre || alumno.email) + " · Admin";
    else if (clave) nombre = "Profesor";
    else if (alumno) nombre = alumno.nombre || alumno.email;
    q.textContent = nombre ? "👤 " + nombre + (clave ? "" : "  ✎") : "";
    q.disabled = !!clave;
    q.style.display = nombre ? "" : "none";
  }

  function cerrarSesion(msg) {
    alumno = null;
    clave = "";
    try { localStorage.removeItem("itma_alumno"); localStorage.removeItem("itma_clave"); } catch (e) {}
    clases = [];
    $("salir").style.display = "none";
    ajustarAdminBtn();
    $("panel").classList.remove("show");
    $("panelAlumnos").classList.remove("show");
    actualizarQuien();
    dibujar();
    mostrarLogin(msg);
  }

  async function cargar() {
    if (!hayAPI()) {
      clases = deBase();
      modulos = ["Clases"];
      fillModulos();
      $("nota").textContent = "Mostrando clases de ejemplo. Falta conectar con Drive (URL de Apps Script).";
      ocultarLogin();
      dibujar();
      return;
    }
    if (!clave && !alumno) { mostrarLogin(); return; }
    try {
      const r = clave ? await post({ action: "adminList" })
                      : await post({ action: "login", email: alumno.email, code: alumno.code });
      if (r.error) { cerrarSesion(r.error); return; }
      const lista = Array.isArray(r) ? r : r.clases;
      vistos = new Set(Array.isArray(r) ? [] : (r.vistos || []));
      if (!clave && alumno && !Array.isArray(r) && r.nombre !== undefined) {
        alumno.nombre = r.nombre || "";
        try { localStorage.setItem("itma_alumno", JSON.stringify(alumno)); } catch (e) {}
      }
      if (!clave && alumno && !Array.isArray(r) && r.admin) { clave = "@rol"; return cargar(); }
      modulos = (!Array.isArray(r) && r.modulos && r.modulos.length) ? r.modulos : ["Clases"];
      areas = (!Array.isArray(r) && r.areas && r.areas.length) ? r.areas : ["Clases"];
      modAreas = (!Array.isArray(r) && r.modAreas) ? r.modAreas : modulos.map(() => 0);
      if (areaActual >= areas.length) areaActual = 0;
      clases = lista.filter(x => x.tipo !== "pdf")
        .map(x => ({ titulo: x.title, id: x.id, locked: x.locked, mod: x.mod || 0 }));
      materiales = lista.filter(x => x.tipo === "pdf")
        .map(x => ({ titulo: x.title, id: x.id, locked: x.locked, mod: x.mod || 0, tipo: "pdf" }));
      fillModulos();
      $("nota").textContent = "";
      ocultarLogin();
      $("salir").style.display = "inline-block";
      actualizarQuien();
      if (clave) {
        $("panel").classList.add("show");
        $("panelAlumnos").classList.add("show");
        $("admin").style.display = "none";
        $("aadminwrap").style.display = clave === "@rol" ? "none" : "";
        cargarAlumnos();
      }
    } catch (e) {
      clases = [];
      $("nota").textContent = "No se pudo conectar con Drive (" + e.message + ").";
      if (!clave && alumno) $("nota").textContent = "No se pudo conectar. Revisa tu internet y recarga la página.";
    }
    dibujar();
  }

  // ---------- Entrada de alumnos ----------
  $("lok").onclick = async () => {
    const email = $("lemail").value.trim().toLowerCase();
    const code = $("lcode").value.trim();
    if (!email || !code) { $("lerr").textContent = "Escribe tu correo y tu código."; return; }
    $("lok").disabled = true;
    $("lok").classList.add("cargando");
    $("lerr").textContent = "";
    alumno = { email, code };
    await cargar();
    $("lok").disabled = false;
    $("lok").classList.remove("cargando");
    if (alumno) {
      try { localStorage.setItem("itma_alumno", JSON.stringify(alumno)); } catch (e) {}
    }
    if (alumno) $("lcode").value = "";
  };
  $("lcode").onkeydown = e => { if (e.key === "Enter") $("lok").click(); };
  $("lemail").onkeydown = e => { if (e.key === "Enter") $("lcode").focus(); };
  $("salir").onclick = () => { cerrarSesion(""); };
  $("lver").onclick = () => {
    const i = $("lcode");
    const ver = i.type === "password";
    i.type = ver ? "text" : "password";
    $("lver").textContent = ver ? "🙈" : "👁";
  };
  $("lprof").onclick = () => { $("admin").click(); };

  function miniatura(c) {
    const t = document.createElement("div");
    t.className = "thumb";
    const puedeVer = c.id && (!c.locked || clave);
    if (puedeVer) {
      const img = document.createElement("img");
      img.alt = ""; img.loading = "lazy";
      img.src = `https://drive.google.com/thumbnail?id=${c.id}&sz=w640`;
      img.onerror = () => img.remove();
      t.appendChild(img);
    }
    const b = document.createElement("div");
    b.className = "badge";
    b.textContent = c.locked ? "🔒" : "▶";
    t.appendChild(b);
    if (c.id && vistos.has(c.id) && !clave) {
      const v = document.createElement("div");
      v.className = "visto";
      v.textContent = "✓";
      v.title = "Clase vista";
      t.appendChild(v);
    }
    return t;
  }

  // Número de la clase dentro de su módulo
  function num(i) {
    let n = 0;
    for (let k = 0; k <= i; k++) if (clases[k].mod === clases[i].mod) n++;
    return n;
  }

  function fillModulos() {
    const s = $("pmod");
    const actual = s.value;
    s.innerHTML = "";
    modulos.forEach((m, k) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = (areas.length > 1 && modAreas[k] !== undefined ? areas[modAreas[k]] + " · " : "") + m;
      s.appendChild(o);
    });
    if (actual) s.value = actual;
    s.style.display = modulos.length > 1 ? "" : "none";
  }

  function dibujarTabs() {
    const t = $("tabs");
    t.innerHTML = "";
    if (areas.length < 2 || $("q").value.trim()) { t.style.display = "none"; return; }
    t.style.display = "";
    areas.forEach((n, k) => {
      const b = document.createElement("button");
      b.className = "tab" + (k === areaActual ? " activa" : "");
      b.textContent = n;
      b.onclick = () => {
        areaActual = k;
        try { localStorage.setItem("itma_area", String(k)); } catch (e) {}
        dibujar();
      };
      t.appendChild(b);
    });
  }

  // Botones Bloquear / Eliminar (solo profesor)
  function botonesAdmin(c, parent) {
    const b = document.createElement("button");
    b.className = "btn lockbtn";
    b.textContent = c.locked ? "Desbloquear" : "Bloquear";
    b.onclick = async e => {
      e.stopPropagation();
      const avisar = c.locked && c.tipo !== "pdf" && confirm("¿Avisar por correo a todos los alumnos que esta clase ya está disponible?");
      b.disabled = true;
      const r = await post({ action: "lock", id: c.id, locked: !c.locked, avisar });
      if (r.aviso) alert("Aviso enviado a " + r.aviso.enviados + " de " + r.aviso.total + " alumnos.");
      cargar();
    };
    parent.appendChild(b);
    const del = document.createElement("button");
    del.className = "btn lockbtn delbtn";
    del.textContent = "Eliminar";
    del.onclick = async e => {
      e.stopPropagation();
      if (!confirm("¿Eliminar «" + c.titulo + "»?\n\nSe enviará a la papelera de tu Drive y podrás recuperarla durante 30 días.")) return;
      del.disabled = true;
      const r = await post({ action: "borrar", id: c.id });
      if (r.error) { alert(r.error); del.disabled = false; return; }
      cargar();
    };
    parent.appendChild(del);
  }

  function tarjetaClase(c, i) {
    const card = document.createElement("div");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.appendChild(miniatura(c));
    const info = document.createElement("div");
    info.className = "info";
    info.innerHTML = "<h3></h3><p></p>";
    info.querySelector("h3").textContent = c.titulo;
    info.querySelector("p").textContent = "Clase " + num(i);
    if (clave) botonesAdmin(c, info);
    card.appendChild(info);
    card.onclick = () => ver(i);
    card.onkeydown = e => { if (e.key === "Enter") ver(i); };
    return card;
  }

  function dibujar() {
    const q = $("q").value.trim().toLowerCase();
    const grid = $("grid");
    grid.innerHTML = "";
    dibujarTabs();
    const coincide = x => !q || x.titulo.toLowerCase().includes(q);
    const enArea = k => q || modAreas[k] === areaActual;
    const modsArea = modulos.filter((m, k) => enArea(k)).length;
    let hay = false;
    modulos.forEach((nombre, k) => {
      if (!enArea(k)) return;
      const vids = clases.map((c, i) => ({ c, i })).filter(x => x.c.mod === k && coincide(x.c));
      const pdfs = materiales.filter(p => p.mod === k && coincide(p));
      if (!vids.length && !pdfs.length) return;
      hay = true;
      const w = document.createElement("section");
      w.className = "modulo";
      if (modsArea > 1) {
        const h = document.createElement("h2");
        h.textContent = (q && areas.length > 1 ? areas[modAreas[k]] + " · " : "") + nombre;
        w.appendChild(h);
      }
      if (vids.length) {
        const g = document.createElement("div");
        g.className = "grid";
        vids.forEach(({ c, i }) => g.appendChild(tarjetaClase(c, i)));
        w.appendChild(g);
      }
      if (pdfs.length) {
        const m = document.createElement("div");
        m.className = "material";
        m.innerHTML = "<h3>📄 Material en PDF</h3>";
        pdfs.forEach(p => {
          const row = document.createElement("div");
          row.className = "pdfrow";
          row.tabIndex = 0;
          const t = document.createElement("span");
          t.textContent = (p.locked ? "🔒 " : "📄 ") + p.titulo;
          row.appendChild(t);
          if (clave) {
            const acc = document.createElement("div");
            botonesAdmin(p, acc);
            row.appendChild(acc);
          }
          row.onclick = () => abrirPDF(p);
          row.onkeydown = e => { if (e.key === "Enter") abrirPDF(p); };
          m.appendChild(row);
        });
        w.appendChild(m);
      }
      grid.appendChild(w);
    });
    $("vacio").hidden = hay;
    actualizarContinuar();
  }

  // ---------- Visor de PDF ----------
  function abrirPDF(p) {
    if (p.locked && !clave) { alert("Este material está bloqueado por ahora."); return; }
    $("pdftitle").textContent = p.titulo;
    $("pdfframe").src = "https://drive.google.com/file/d/" + p.id + "/preview";
    $("pdfopen").href = "https://drive.google.com/file/d/" + p.id + "/view";
    $("pdfmodal").classList.add("open");
  }
  function cerrarPDF() {
    $("pdfmodal").classList.remove("open");
    $("pdfframe").src = "about:blank";
  }
  $("pdfclose").onclick = cerrarPDF;
  $("pdfmodal").addEventListener("click", e => { if (e.target === $("pdfmodal")) cerrarPDF(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarPDF(); });

  // ---------- Clases vistas / continuar ----------
  function marcarVisto(c) {
    if (clave || !alumno || !c.id || c.locked || vistos.has(c.id)) return;
    vistos.add(c.id);
    post({ action: "visto", email: alumno.email, code: alumno.code, id: c.id }).catch(() => {});
  }

  function actualizarContinuar() {
    const b = $("continuar");
    if (clave || !alumno) { b.hidden = true; return; }
    const enA = c => modAreas[c.mod] === areaActual;
    const disp = clases.filter(c => c.id && !c.locked && enA(c)).length;
    const i = clases.findIndex(c => c.id && !c.locked && enA(c) && !vistos.has(c.id));
    if (!disp) { b.hidden = true; return; }
    b.hidden = false;
    if (i === -1) {
      b.textContent = "✓ Ya viste todas las clases disponibles";
      b.disabled = true;
      b.onclick = null;
      return;
    }
    b.disabled = false;
    b.textContent = (vistos.size ? "▶ Continuar: " : "▶ Empezar: ") + "Clase " + num(i) + (modulos.length > 1 ? " (" + modulos[clases[i].mod] + ")" : "") + " · " + clases[i].titulo;
    b.onclick = () => ver(i);
  }

  function ver(i) {
    const c = clases[i];
    marcarVisto(c);
    $("home").classList.add("hide");
    $("watch").classList.add("show");
    $("wtitle").textContent = c.titulo;
    const p = $("player");
    const etiqueta = (modulos.length > 1 ? modulos[c.mod] + " · " : "") + "Clase " + num(i);
    $("wsub").textContent = etiqueta;
    if (c.locked && !clave) {
      p.innerHTML = '<div class="msg">Esta clase está bloqueada por ahora.</div>';
    } else if (!c.id) {
      p.innerHTML = '<div class="msg">Esta clase aún no tiene video.</div>';
    } else {
      p.innerHTML = `<iframe class="frame" src="https://drive.google.com/file/d/${c.id}/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
      $("wsub").innerHTML = `${etiqueta} · ¿No carga en tu teléfono? <a target="_blank" rel="noopener" href="https://drive.google.com/file/d/${c.id}/view">Ábrelo en Drive</a>`;
    }
    $("side").querySelector("h3").textContent = modulos.length > 1 ? "Más de: " + modulos[c.mod] : "Más clases";
    const list = $("list");
    list.innerHTML = "";
    clases.forEach((o, j) => {
      if (j === i || o.mod !== c.mod) return;
      const it = document.createElement("div");
      it.className = "item";
      it.appendChild(miniatura(o));
      const d = document.createElement("div");
      d.innerHTML = "<h4></h4><p></p>";
      d.querySelector("h4").textContent = o.titulo;
      d.querySelector("p").textContent = "Clase " + num(j);
      it.appendChild(d);
      it.onclick = () => ver(j);
      list.appendChild(it);
    });
    window.scrollTo(0, 0);
  }

  function inicio() {
    dibujar();
    $("player").innerHTML = "";
    $("watch").classList.remove("show");
    $("home").classList.remove("hide");
  }
  $("back").onclick = inicio;
  $("q").oninput = () => { inicio(); dibujar(); };

  // ---------- Acceso profesor (la clave la verifica el servidor) ----------
  $("admin").onclick = async () => {
    if (!hayAPI()) { alert("Primero conecta la página con tu Apps Script (variable API)."); return; }
    const k = prompt("Clave de profesor:");
    if (!k) return;
    clave = k;
    try {
      const r = await post({ action: "adminList" });
      if (r.error) { clave = ""; alert(r.error); return; }
    } catch (e) { clave = ""; alert("No se pudo conectar con el script: " + e.message); return; }
    $("panel").classList.add("show");
    $("panelAlumnos").classList.add("show");
    $("admin").style.display = "none";
    try { localStorage.setItem("itma_clave", clave); } catch (e) {}
    ocultarLogin();
    cargarAlumnos();
    cargar();
  };

  // ---------- Alumnos (solo profesor) ----------
  async function cargarAlumnos() {
    const r = await post({ action: "alumnoList" });
    const box = $("alista");
    box.innerHTML = "";
    if (r.error) { $("amsg").textContent = r.error; return; }
    if (!r.length) { box.innerHTML = '<p class="hint" style="color:var(--muted);margin-top:10px">Aún no hay alumnos registrados.</p>'; return; }
    r.forEach(a => {
      const wrap = document.createElement("div");
      wrap.className = "alw";
      const row = document.createElement("div");
      row.className = "al";
      const t = document.createElement("span");
      t.textContent = (a.nombre ? a.nombre + "  ·  " : "") + a.email + "  ·  código: ";
      const c = document.createElement("code");
      c.textContent = a.code;
      t.appendChild(c);
      if (a.admin) {
        const tg = document.createElement("span");
        tg.className = "tagadm";
        tg.textContent = "ADMIN";
        t.appendChild(tg);
      }
      const acc = document.createElement("div");
      acc.className = "acc2";
      const ed = document.createElement("button");
      ed.className = "btn small";
      ed.textContent = "Editar";
      const b = document.createElement("button");
      b.className = "btn small";
      b.textContent = "Quitar";
      b.onclick = async () => {
        if (!confirm("¿Quitar a " + a.email + "?")) return;
        await post({ action: "alumnoDel", email: a.email });
        cargarAlumnos();
      };
      const form = formEditar(a);
      ed.onclick = () => { form.hidden = !form.hidden; };
      acc.appendChild(ed);
      acc.appendChild(b);
      row.appendChild(t);
      row.appendChild(acc);
      wrap.appendChild(row);
      wrap.appendChild(form);
      box.appendChild(wrap);
    });
  }

  // Formulario para editar nombre, apellido, correo y código de un alumno
  function formEditar(a) {
    const f = document.createElement("div");
    f.className = "edit";
    f.hidden = true;
    f.innerHTML = '<input type="text" class="e-nombre" placeholder="Nombre">' +
      '<input type="text" class="e-apellido" placeholder="Apellido">' +
      '<input type="text" class="e-email" placeholder="Correo" autocapitalize="none">' +
      '<input type="text" class="e-code" placeholder="Código de acceso" autocapitalize="none">' +
      (clave === "@rol" ? "" : '<label class="chk"><input type="checkbox" class="e-admin"> Administrador</label>') +
      '<label class="chk"><input type="checkbox" class="e-avisar" checked> Avisar por correo</label>' +
      '<button class="btn main small e-ok">Guardar cambios</button>' +
      '<button class="btn small e-no">Cancelar</button>' +
      '<p class="e-msg"></p>';
    const partes = (a.nombre || "").split(" ");
    f.querySelector(".e-nombre").value = partes.shift() || "";
    f.querySelector(".e-apellido").value = partes.join(" ");
    f.querySelector(".e-email").value = a.email;
    f.querySelector(".e-code").value = a.code;
    const ea = f.querySelector(".e-admin");
    if (ea) ea.checked = !!a.admin;
    f.querySelector(".e-no").onclick = () => { f.hidden = true; };
    f.querySelector(".e-ok").onclick = async () => {
      const ok = f.querySelector(".e-ok");
      const msg = f.querySelector(".e-msg");
      const email = f.querySelector(".e-email").value.trim();
      if (!email) { msg.textContent = "El correo no puede quedar vacío."; return; }
      ok.disabled = true;
      msg.textContent = "Guardando…";
      const r = await post({
        action: "alumnoEdit",
        oldEmail: a.email,
        email: email,
        nombre: f.querySelector(".e-nombre").value.trim(),
        apellido: f.querySelector(".e-apellido").value.trim(),
        code: f.querySelector(".e-code").value.trim(),
        avisar: f.querySelector(".e-avisar").checked,
        admin: ea ? ea.checked : false
      });
      ok.disabled = false;
      if (r.error) { msg.textContent = r.error; return; }
      $("amsg").textContent = "Actualizado: " + (r.nombre ? r.nombre + " · " : "") + r.email + " · código " + r.code +
        (r.enviado === true ? " · correo enviado" : r.enviado === false ? " · no se pudo enviar el correo" : "");
      cargarAlumnos();
    };
    return f;
  }

  $("aok").onclick = async () => {
    const nombre = $("anombre").value.trim();
    const apellido = $("aapellido").value.trim();
    const email = $("aemail").value.trim();
    if (!nombre || !apellido || !email) { $("amsg").textContent = "Escribe el nombre, el apellido y el correo del alumno."; return; }
    $("aok").disabled = true;
    const r = await post({ action: "alumnoAdd", nombre, apellido, email, code: $("acode").value.trim(), admin: $("aadmin").checked });
    $("aok").disabled = false;
    if (r.error) { $("amsg").textContent = r.error; return; }
    $("amsg").textContent = "Agregado: " + r.nombre + " (" + r.email + ") · código " + r.code + (r.enviado ? " · correo enviado" : " · no se pudo enviar el correo, pásale el código tú");
    $("anombre").value = ""; $("aapellido").value = ""; $("aemail").value = ""; $("acode").value = ""; $("aadmin").checked = false;
    cargarAlumnos();
  };

  $("pok").onclick = async () => {
    const file = $("parchivo").files[0];
    const titulo = $("ptitulo").value.trim();
    const msg = $("pmsg");
    if (!titulo || !file) { msg.textContent = "Escribe el título y elige un video."; return; }
    $("pok").disabled = true;
    msg.textContent = "Preparando la subida…";
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const name = `${Date.now()}.${ext}`;
    const s = await post({ action: "session", modulo: Number($("pmod").value) || 0, name, type: file.type || "video/mp4", origin: location.origin });
    if (s.error) { msg.textContent = "Error: " + s.error; $("pok").disabled = false; return; }
    $("bar").style.display = "block";
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", s.url);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    let avance = 0;
    xhr.upload.onprogress = e => {
      avance = e.loaded / e.total;
      $("fill").style.width = Math.round(avance * 100) + "%";
      msg.textContent = `Subiendo… ${Math.round(avance * 100)}%`;
    };
    const terminar = async () => {
      msg.textContent = "Guardando en la carpeta…";
      const f = await post({ action: "finish", modulo: Number($("pmod").value) || 0, name, title: titulo, locked: $("pbloq").checked, avisar: $("pavisar").checked });
      $("pok").disabled = false;
      if (f.error) { msg.textContent = "Error: " + f.error; return; }
      msg.textContent = "¡Clase subida!" + (f.aviso ? " Aviso enviado a " + f.aviso.enviados + " de " + f.aviso.total + " alumnos." : "");
      $("ptitulo").value = ""; $("parchivo").value = "";
      $("bar").style.display = "none"; $("fill").style.width = "0";
      cargar();
    };
    xhr.onload = terminar;
    xhr.onerror = () => {
      if (avance > 0.99) terminar();
      else { msg.textContent = "Se cortó la subida. Intenta de nuevo."; $("pok").disabled = false; }
    };
    xhr.send(file);
  };



  // ---------- Mis datos (el alumno cambia su nombre y su código; el correo no) ----------
  function abrirPerfil() {
    if (clave || !alumno) return;
    const partes = (alumno.nombre || "").split(" ");
    $("pf-nombre").value = partes.shift() || "";
    $("pf-apellido").value = partes.join(" ");
    $("pf-email").textContent = alumno.email;
    $("pf-code").value = "";
    $("pf-code2").value = "";
    $("pf-msg").textContent = "";
    $("perfil").classList.add("open");
  }
  function cerrarPerfil() { $("perfil").classList.remove("open"); }
  $("quien").onclick = abrirPerfil;
  $("pf-no").onclick = cerrarPerfil;
  $("perfil").addEventListener("click", e => { if (e.target === $("perfil")) cerrarPerfil(); });
  $("pf-ok").onclick = async () => {
    const msg = $("pf-msg");
    const nombre = $("pf-nombre").value.trim();
    const apellido = $("pf-apellido").value.trim();
    const c1 = $("pf-code").value.trim();
    const c2 = $("pf-code2").value.trim();
    if (!nombre || !apellido) { msg.textContent = "Escribe tu nombre y apellido."; return; }
    if (c1 || c2) {
      if (c1 !== c2) { msg.textContent = "Los dos códigos no coinciden."; return; }
      if (c1.length < 4) { msg.textContent = "El código debe tener al menos 4 caracteres."; return; }
    }
    $("pf-ok").disabled = true;
    msg.textContent = "Guardando…";
    try {
      const r = await post({ action: "perfilEdit", email: alumno.email, code: alumno.code, nombre, apellido, nuevoCode: c1 });
      if (r.error) { msg.textContent = r.error; return; }
      alumno.nombre = r.nombre;
      if (c1) alumno.code = c1;
      try { localStorage.setItem("itma_alumno", JSON.stringify(alumno)); } catch (e) {}
      actualizarQuien();
      msg.textContent = "¡Datos actualizados!";
      setTimeout(cerrarPerfil, 900);
    } catch (e) {
      msg.textContent = "No se pudo guardar. Revisa tu internet.";
    } finally {
      $("pf-ok").disabled = false;
    }
  };


  // ---------- Tema claro / oscuro (se recuerda en este dispositivo) ----------
  function pintarTema(t) {
    document.documentElement.setAttribute("data-tema", t);
    $("tema").textContent = t === "light" ? "🌙" : "☀️";
    $("tema").title = t === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro";
  }
  pintarTema(document.documentElement.getAttribute("data-tema") === "light" ? "light" : "dark");
  $("tema").onclick = () => {
    const nuevo = document.documentElement.getAttribute("data-tema") === "light" ? "dark" : "light";
    pintarTema(nuevo);
    try { localStorage.setItem("itma_tema", nuevo); } catch (e) {}
  };


  // El botón "Acceso profesor" no se ve para los alumnos. Solo aparece si se abre la página con #admin al final
  // (queda recordado en ese dispositivo). Los administradores nombrados entran con su propio correo y código.
  function ajustarAdminBtn() {
    let ver = location.hash === "#admin";
    try {
      if (ver) localStorage.setItem("itma_adminlink", "1");
      else ver = localStorage.getItem("itma_adminlink") === "1";
    } catch (e) {}
    const mostrar = ver && !clave;
    $("admin").style.display = mostrar ? "inline-block" : "none";
    $("lprof").style.display = mostrar ? "" : "none";
  }
  window.addEventListener("hashchange", ajustarAdminBtn);
  ajustarAdminBtn();

  cargar();
