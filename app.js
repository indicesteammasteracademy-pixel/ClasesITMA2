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
    const r = await fetch(API, { method: "POST", body: JSON.stringify({ password: clave, ...body }) });
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
  function cerrarSesion(msg) {
    alumno = null;
    clave = "";
    try { localStorage.removeItem("itma_alumno"); localStorage.removeItem("itma_clave"); } catch (e) {}
    clases = [];
    $("salir").style.display = "none";
    $("admin").style.display = "inline-block";
    $("panel").classList.remove("show");
    $("panelAlumnos").classList.remove("show");
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
      modulos = (!Array.isArray(r) && r.modulos && r.modulos.length) ? r.modulos : ["Clases"];
      clases = lista.map(x => ({ titulo: x.title, id: x.id, locked: x.locked, mod: x.mod || 0 }));
      fillModulos();
      $("nota").textContent = "";
      ocultarLogin();
      $("salir").style.display = "inline-block";
      if (clave) {
        $("panel").classList.add("show");
        $("panelAlumnos").classList.add("show");
        $("admin").style.display = "none";
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
      o.textContent = m;
      s.appendChild(o);
    });
    if (actual) s.value = actual;
    s.style.display = modulos.length > 1 ? "" : "none";
  }

  function dibujar() {
    const q = $("q").value.trim().toLowerCase();
    const grid = $("grid");
    grid.innerHTML = "";
    const lista = clases.map((c, i) => ({ c, i })).filter(x => !q || x.c.titulo.toLowerCase().includes(q));
    $("vacio").hidden = lista.length > 0;
    const secciones = {};
    lista.forEach(({ c, i }) => {
      let sec = secciones[c.mod];
      if (!sec) {
        const w = document.createElement("section");
        w.className = "modulo";
        if (modulos.length > 1) {
          const h = document.createElement("h2");
          h.textContent = modulos[c.mod] || "Clases";
          w.appendChild(h);
        }
        sec = document.createElement("div");
        sec.className = "grid";
        w.appendChild(sec);
        grid.appendChild(w);
        secciones[c.mod] = sec;
      }
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
      if (clave) {
        const b = document.createElement("button");
        b.className = "btn lockbtn";
        b.textContent = c.locked ? "Desbloquear" : "Bloquear";
        b.onclick = async e => {
          e.stopPropagation();
          const avisar = c.locked && confirm("¿Avisar por correo a todos los alumnos que esta clase ya está disponible?");
          b.disabled = true;
          const r = await post({ action: "lock", id: c.id, locked: !c.locked, avisar });
          if (r.aviso) alert("Aviso enviado a " + r.aviso.enviados + " de " + r.aviso.total + " alumnos.");
          cargar();
        };
        info.appendChild(b);
      }
      card.appendChild(info);
      card.onclick = () => ver(i);
      card.onkeydown = e => { if (e.key === "Enter") ver(i); };
      sec.appendChild(card);
    });
    actualizarContinuar();
  }

  // ---------- Clases vistas / continuar ----------
  function marcarVisto(c) {
    if (clave || !alumno || !c.id || c.locked || vistos.has(c.id)) return;
    vistos.add(c.id);
    post({ action: "visto", email: alumno.email, code: alumno.code, id: c.id }).catch(() => {});
  }

  function actualizarContinuar() {
    const b = $("continuar");
    if (clave || !alumno) { b.hidden = true; return; }
    const disp = clases.filter(c => c.id && !c.locked).length;
    const i = clases.findIndex(c => c.id && !c.locked && !vistos.has(c.id));
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
      const row = document.createElement("div");
      row.className = "al";
      const t = document.createElement("span");
      t.textContent = a.email + "  ·  código: ";
      const c = document.createElement("code");
      c.textContent = a.code;
      t.appendChild(c);
      const b = document.createElement("button");
      b.className = "btn small";
      b.textContent = "Quitar";
      b.onclick = async () => {
        if (!confirm("¿Quitar a " + a.email + "?")) return;
        await post({ action: "alumnoDel", email: a.email });
        cargarAlumnos();
      };
      row.appendChild(t);
      row.appendChild(b);
      box.appendChild(row);
    });
  }

  $("aok").onclick = async () => {
    const email = $("aemail").value.trim();
    if (!email) { $("amsg").textContent = "Escribe el correo del alumno."; return; }
    $("aok").disabled = true;
    const r = await post({ action: "alumnoAdd", email, code: $("acode").value.trim() });
    $("aok").disabled = false;
    if (r.error) { $("amsg").textContent = r.error; return; }
    $("amsg").textContent = "Agregado: " + r.email + " · código " + r.code + (r.enviado ? " · correo enviado" : " · no se pudo enviar el correo, pásale el código tú");
    $("aemail").value = ""; $("acode").value = "";
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

  cargar();
