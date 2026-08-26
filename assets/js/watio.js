/* =========================================================================
   Marcos — Asistente Dental de WhiteMoon (demo clínica dental)
   Flujo (estilo talleres): categoría -> zona -> datos -> cierre.
   Lead -> Supabase leads_web (sector=Clínica dental, origen=dental-demo)
        -> Edge Function dental-notify (aviso al equipo).
   El circuito de captación NO cambia: mismos endpoints y mismo payload.
   La publishable key va en cliente (solo INSERT vía RLS). La apikey del
   notificador NUNCA está aquí: vive en los Secrets de la Edge Function.
   ========================================================================= */
(() => {
  "use strict";

  const SUPABASE_URL = "https://mlaqtniujnvfxcvcourm.supabase.co";
  const SUPABASE_KEY = "sb_publishable_6no6BuOgiA_2nonTJntAuQ_DTqEgrcV";
  const NOTIFY_FN = SUPABASE_URL + "/functions/v1/dental-notify";
  const LEADS_URL = SUPABASE_URL + "/rest/v1/leads_web";
  const ORIGEN = "dental-demo";
  const SECTOR = "Clínica dental";
  const TELEFONO = "643 199 580";

  /* Categorías: mismos nombres que usan los botones "Pedir cita" de las
     tarjetas de servicio (data-servicio). */
  const WORKS = [
    { id: "cita",     label: "Primera visita",              interes: "Primera visita / valoración" },
    { id: "implante", label: "Implantes",                   interes: "Implantología" },
    { id: "orto",     label: "Ortodoncia / Invisalign",     interes: "Ortodoncia" },
    { id: "estetica", label: "Estética dental",             interes: "Estética dental" },
    { id: "higiene",  label: "Higiene y limpieza",          interes: "Higiene y prevención" },
    { id: "endo",     label: "Endodoncia",                  interes: "Endodoncia" },
    { id: "pedia",    label: "Odontopediatría / Urgencias", interes: "Odontopediatría / Urgencias" },
  ];

  /* Qué incluye cada tratamiento — se cuenta antes de pedir los datos. */
  const INFO = {
    "Primera visita": "La primera visita es sin compromiso: exploramos tu boca, resolvemos tus dudas y, si hace falta, hacemos una radiografía de diagnóstico. Salgas de aquí con tratamiento o sin él, te llevas el plan explicado.",
    "Implantes": "Reponemos la pieza perdida con planificación digital previa: estudiamos el hueso, colocamos el implante y ponemos la corona cuando ha integrado. Orientativo desde 1.250 € implante + corona, con presupuesto cerrado por escrito.",
    "Ortodoncia / Invisalign": "Alineadores invisibles o brackets, según tu caso y tu día a día. Te enseñamos la simulación del resultado antes de decidir. Orientativo desde 2.400 € con brackets y desde 2.750 € con alineadores, financiable a medida.",
    "Estética dental": "Blanqueamiento, carillas y reconstrucciones de composite, buscando un resultado natural y proporcionado. Orientativo: carilla de composite desde 180 €, de porcelana desde 480 € y blanqueamiento en clínica desde 250 €.",
    "Higiene y limpieza": "Limpieza profesional, control de encías y consejos de cepillado adaptados a ti. Orientativo desde 55 €. Es la forma más barata de no acabar en tratamientos largos.",
    "Endodoncia": "El clásico «matar el nervio», con buena anestesia y microscopía cuando hace falta. El objetivo siempre es salvar tu diente. Orientativo desde 120 € según el número de raíces.",
    "Odontopediatría / Urgencias": "Revisiones y selladores para los peques, sin dramas: la revisión infantil es gratuita y el sellador orientativo desde 35 €. Y si hay dolor, flemón o un diente roto, guardamos huecos diarios de urgencia desde 45 €.",
  };

  const ZONES = [
    "Majadahonda", "Pozuelo de Alarcón", "Las Rozas", "Boadilla del Monte",
    "Villaviciosa de Odón", "Villanueva de la Cañada", "Brunete", "Alcorcón", "Móstoles", "Otra zona",
  ];

  const $ = (s, c = document) => c.querySelector(s);
  const panel = $("#watio");
  if (!panel) return;
  const body = $(".watio-body", panel);
  const quick = $(".watio-quick", panel);
  const form = $(".watio-foot", panel);
  const input = $(".watio-foot input", panel);
  const sendBtn = $(".watio-foot button", panel);
  const btn = $("#watio-open");

  const lead = { servicio: "", interes: "", zona: "", nombre: "", telefono: "" };
  let step = "work";       // work -> zone -> name -> phone -> done
  let started = false;

  /* ---------- helpers UI ---------- */
  const scroll = () => { body.scrollTop = body.scrollHeight; };
  const addMsg = (text, who = "bot") => {
    const el = document.createElement("div");
    el.className = "watio-msg " + who;
    el.textContent = text;
    body.appendChild(el); scroll();
  };
  const typing = () => {
    const t = document.createElement("div");
    t.className = "watio-typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    body.appendChild(t); scroll();
    return t;
  };
  const botSay = (text, after) =>
    new Promise((res) => {
      const t = typing();
      setTimeout(() => {
        t.remove(); addMsg(text, "bot");
        if (after) after();
        res();
      }, Math.min(900, 340 + text.length * 8));
    });
  const clearQuick = () => { quick.innerHTML = ""; };
  const setQuick = (items, onPick) => {
    clearQuick();
    items.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = it.label || it;
      b.addEventListener("click", () => onPick(it));
      quick.appendChild(b);
    });
  };
  const setInput = (enabled, placeholder) => {
    input.disabled = !enabled; sendBtn.disabled = !enabled;
    input.placeholder = placeholder || "Escribe tu respuesta…";
    if (enabled) setTimeout(() => input.focus(), 60);
  };

  /* ---------- flujo: categoría -> zona -> datos -> cierre ---------- */
  const start = async () => {
    if (started) return; started = true;
    setInput(false);
    await botSay("Hola, soy Marcos, el asistente dental de WhiteMoon. Te ayudo a pedir tu cita sin compromiso en un minuto.");
    await botSay("¿Qué necesitas?", () => {
      setQuick(WORKS, (w) => { addMsg(w.label, "user"); pickWork(w.label); });
    });
  };

  /* Elegido el tratamiento: primero cuenta qué incluye, luego encadena la cita. */
  const pickWork = async (label) => {
    const w = WORKS.find((x) => x.label === label) || WORKS[0];
    lead.servicio = w.label; lead.interes = w.interes;
    clearQuick();
    const info = INFO[w.label];
    if (info) await botSay(info);
    askZone();
  };

  const askZone = async () => {
    step = "zone";
    await botSay("¿En qué zona estás? Así te damos el hueco que mejor te venga.", () => {
      setQuick(ZONES, (z) => {
        if (z === "Otra zona") {
          clearQuick();
          setInput(true, "Escribe tu localidad…");
          botSay("Dime tu localidad y lo vemos igualmente.");
          return;
        }
        addMsg(z, "user"); lead.zona = z; clearQuick(); askName();
      });
    });
  };

  const askName = async () => {
    step = "name";
    clearQuick();
    await botSay("¿Con quién hablo? Dime tu nombre.", () => setInput(true, "Tu nombre…"));
  };

  const askPhone = async () => {
    step = "phone";
    await botSay("Gracias, " + lead.nombre.split(" ")[0] + ". ¿A qué teléfono te llamamos?", () =>
      setInput(true, "Tu teléfono…")
    );
  };

  const finish = async () => {
    step = "done";
    setInput(false); clearQuick();
    const t = typing();
    const ok = await submitLead();
    t.remove();
    if (ok) {
      addMsg(
        "¡Listo, " + lead.nombre.split(" ")[0] + "! Hemos recibido tu solicitud (" +
        lead.servicio.toLowerCase() + " · " + lead.zona + "). Un odontólogo de WhiteMoon Dental te llamará al " +
        lead.telefono + " para cerrar día y hora. La primera visita es sin compromiso.",
        "bot"
      );
      setTimeout(() => addMsg("Si lo prefieres, también puedes llamarnos ahora al " + TELEFONO + ".", "bot"), 700);
    } else {
      addMsg(
        "He guardado tus datos pero hubo un problema de conexión. Para no esperar, llámanos al " + TELEFONO + " y te atendemos al momento.",
        "bot"
      );
    }
  };

  /* ---------- entrada de texto ---------- */
  /* Guard: mínimo 9 dígitos reales (admite prefijo +34 / 0034 y separadores). */
  const isPhone = (v) => {
    const d = String(v).replace(/\D/g, "").replace(/^(?:0034|34)(?=[6-9]\d{8})/, "");
    return d.length >= 9 && /^[6-9]\d{8,}$/.test(d);
  };
  const handleText = (raw) => {
    const v = raw.trim();
    if (!v) return;
    addMsg(v, "user");
    input.value = "";
    if (step === "zone") { lead.zona = v; setInput(false); askName(); }
    else if (step === "name") {
      if (v.length < 2) { botSay("¿Me dices tu nombre, por favor?"); return; }
      lead.nombre = v; setInput(false); askPhone();
    } else if (step === "phone") {
      if (!isPhone(v)) { botSay("Ese teléfono no parece válido. Escríbelo con 9 dígitos, por favor."); return; }
      lead.telefono = v; finish();
    }
  };

  form.addEventListener("submit", (e) => { e.preventDefault(); handleText(input.value); });

  /* ---------- envío del lead ----------
     fetch con keepalive (sobrevive a que se cierre la pestaña) y, si falla,
     sendBeacon con la apikey en query string como último recurso. */
  const beacon = (url, payload) => {
    if (!navigator.sendBeacon) return false;
    try {
      const sep = url.includes("?") ? "&" : "?";
      return navigator.sendBeacon(
        url + sep + "apikey=" + encodeURIComponent(SUPABASE_KEY),
        new Blob([JSON.stringify(payload)], { type: "application/json" })
      );
    } catch (e) { return false; }
  };

  const post = async (url, payload, extraHeaders) => {
    try {
      const r = await fetch(url, {
        method: "POST",
        keepalive: true,
        headers: Object.assign({
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY,
          "Content-Type": "application/json",
        }, extraHeaders || {}),
        body: JSON.stringify(payload),
      });
      if (r.ok) return true;
      console.warn("[marcos]", url, r.status, await r.text());
      return beacon(url, payload);
    } catch (e) {
      console.warn("[marcos] error de red:", e);
      return beacon(url, payload);
    }
  };

  async function submitLead() {
    // 1) INSERT en leads_web
    const inserted = await post(LEADS_URL, {
      nombre: lead.nombre,
      telefono: lead.telefono,
      sector: SECTOR,
      interes: lead.interes,
      mensaje: "Servicio: " + lead.servicio + " · Zona: " + lead.zona,
      origen: ORIGEN,
    }, { "Prefer": "return=minimal" });

    // 2) Notificación al equipo (apikey del notificador, server-side)
    await post(NOTIFY_FN, {
      nombre: lead.nombre,
      telefono: lead.telefono,
      sector: SECTOR,
      servicio: lead.servicio,
      zona: lead.zona,
      origen: ORIGEN,
    });

    return inserted;
  }

  /* ---------- abrir / cerrar ---------- */
  const open = (servicio) => {
    panel.classList.add("open");
    /* Cerrado el panel es invisible pero sus botones seguirian siendo
       enfocables con el teclado: inert los saca del recorrido de tabulacion. */
    panel.removeAttribute("inert");
    if (btn) btn.style.display = "none";
    start();
    /* Si vienen de una tarjeta de servicio, saltamos la elección de categoría. */
    if (servicio && step === "work") {
      setTimeout(() => {
        if (step !== "work") return;
        addMsg(servicio, "user");
        pickWork(servicio);
      }, 900);
    }
  };
  const close = () => {
    panel.classList.remove("open");
    panel.setAttribute("inert", "");
    if (btn) btn.style.display = "";
    if (btn) btn.focus();
  };
  btn && btn.addEventListener("click", () => open());
  $(".watio-head__close", panel).addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("open")) close();
  });
  document.querySelectorAll("[data-watio]").forEach((el) =>
    el.addEventListener("click", (e) => { e.preventDefault(); open(el.dataset.servicio); })
  );
})();
