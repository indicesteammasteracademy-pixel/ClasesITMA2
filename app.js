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

  function idDeDrive(link) {
    if (!link) return "";
    const m = link.match(/\/d\/([\w-]+)/) || link.match(/[?&]id=([\w-]+)/);
    return m ? m[1] : "";
  }
  const deBase = () => BASE.map(b => ({ titulo: b.titulo, id: idDeDrive(b.link), locked: b.locked }));
  const hayAPI = () => API.indexOf("http") === 0;

  async function post(body) {
    const r = await fetch(API, { method: "POST", body: JSON.stringify({ password: clave, ...body }) });
    return r.json();
  }

  async function cargar() {
    if (!hayAPI()) {
      clases = deBase();
      $("nota").textContent = "Mostrando clases de ejemplo. Falta conectar con Drive (URL de Apps Script).";
    } else {
      try {
        const r = clave ? await post({ action: "adminList" }) : await (await fetch(API)).json();
        if (r.error) throw new Error(r.error);
        clases = r.map(x => ({ titulo: x.title, id: x.id, locked: x.locked }));
        $("nota").textContent = "";
      } catch (e) {
        clases = deBase();
        $("nota").textContent = "No se pudo conectar con Drive; mostrando clases de ejemplo.";
      }
    }
    dibujar();
  }

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
    return t;
  }

  function dibujar() {
    const q = $("q").value.trim().toLowerCase();
    const grid = $("grid");
    grid.innerHTML = "";
    const lista = clases.map((c, i) => ({ c, i })).filter(x => !q || x.c.titulo.toLowerCase().includes(q));
    $("vacio").hidden = lista.length > 0;
    lista.forEach(({ c, i }) => {
      const card = document.createElement("div");
      card.className = "card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.appendChild(miniatura(c));
      const info = document.createElement("div");
      info.className = "info";
      info.innerHTML = "<h3></h3><p></p>";
      info.querySelector("h3").textContent = c.titulo;
      info.querySelector("p").textContent = "Clase " + (i + 1);
      if (clave) {
        const b = document.createElement("button");
        b.className = "btn lockbtn";
        b.textContent = c.locked ? "Desbloquear" : "Bloquear";
        b.onclick = async e => {
          e.stopPropagation();
          await post({ action: "lock", id: c.id, locked: !c.locked });
          cargar();
        };
        info.appendChild(b);
      }
      card.appendChild(info);
      card.onclick = () => ver(i);
      card.onkeydown = e => { if (e.key === "Enter") ver(i); };
      grid.appendChild(card);
    });
  }

  function ver(i) {
    const c = clases[i];
    $("home").classList.add("hide");
    $("watch").classList.add("show");
    $("wtitle").textContent = c.titulo;
    const p = $("player");
    $("wsub").textContent = "Clase " + (i + 1);
    if (c.locked && !clave) {
      p.innerHTML = '<div class="msg">Esta clase está bloqueada por ahora.</div>';
    } else if (!c.id) {
      p.innerHTML = '<div class="msg">Esta clase aún no tiene video.</div>';
    } else {
      p.innerHTML = `<iframe class="frame" src="https://drive.google.com/file/d/${c.id}/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
      $("wsub").innerHTML = `Clase ${i + 1} · ¿No carga en tu teléfono? <a target="_blank" rel="noopener" href="https://drive.google.com/file/d/${c.id}/view">Ábrelo en Drive</a>`;
    }
    const list = $("list");
    list.innerHTML = "";
    clases.forEach((o, j) => {
      if (j === i) return;
      const it = document.createElement("div");
      it.className = "item";
      it.appendChild(miniatura(o));
      const d = document.createElement("div");
      d.innerHTML = "<h4></h4><p></p>";
      d.querySelector("h4").textContent = o.titulo;
      d.querySelector("p").textContent = "Clase " + (j + 1);
      it.appendChild(d);
      it.onclick = () => ver(j);
      list.appendChild(it);
    });
    window.scrollTo(0, 0);
  }

  function inicio() {
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
    } catch (e) { clave = ""; alert("No se pudo conectar con el script."); return; }
    $("panel").classList.add("show");
    $("admin").style.display = "none";
    cargar();
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
    const s = await post({ action: "session", name, type: file.type || "video/mp4", origin: location.origin });
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
      const f = await post({ action: "finish", name, title: titulo, locked: $("pbloq").checked });
      $("pok").disabled = false;
      if (f.error) { msg.textContent = "Error: " + f.error; return; }
      msg.textContent = "¡Clase subida!";
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
