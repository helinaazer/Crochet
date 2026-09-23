const MAX_DIMENSION = 1568; // Larger images are downscaled by the API anyway
const LOADING_MESSAGES = [
  "Looking closely at your photo…",
  "Matching yarn colors…",
  "Choosing the right hook…",
  "Working out stitch counts…",
  "Writing up your pattern…",
];

const $ = (id) => document.getElementById(id);
const fileInput = $("file-input");
const cameraInput = $("camera-input");
const dropzone = $("dropzone");
const preview = $("preview");
const dropPrompt = $("drop-prompt");
const generateBtn = $("generate");
const notesEl = $("notes");
const errorEl = $("error");
const loadingEl = $("loading");
const loadingText = $("loading-text");
const resultEl = $("result");

let prepared = null; // { data, mediaType }

// ---------- Image selection ----------

fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));
cameraInput.addEventListener("change", () => handleFile(cameraInput.files[0]));

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));

async function handleFile(file) {
  hideError();
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showError("That file isn't an image. Please choose a photo.");
    return;
  }

  try {
    prepared = await downscaleImage(file);
  } catch {
    prepared = null;
    showError("Couldn't read that image. Try a JPEG or PNG (some phones save HEIC photos, which browsers can't open).");
    generateBtn.disabled = true;
    return;
  }

  preview.src = `data:${prepared.mediaType};base64,${prepared.data}`;
  preview.hidden = false;
  dropPrompt.hidden = true;
  generateBtn.disabled = false;
}

// Re-encode as JPEG, capped at MAX_DIMENSION, so phone photos stay small and fast.
function downscaleImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; // flatten transparent PNGs onto white
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
      resolve({ data: dataUrl.split(",")[1], mediaType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

// ---------- Generate ----------

generateBtn.addEventListener("click", async () => {
  if (!prepared) return;
  hideError();
  resultEl.hidden = true;
  generateBtn.disabled = true;
  loadingEl.hidden = false;
  loadingEl.scrollIntoView({ behavior: "smooth", block: "center" });

  let msgIndex = 0;
  loadingText.textContent = LOADING_MESSAGES[0];
  const ticker = setInterval(() => {
    msgIndex = Math.min(msgIndex + 1, LOADING_MESSAGES.length - 1);
    loadingText.textContent = LOADING_MESSAGES[msgIndex];
  }, 12000);

  try {
    const res = await fetch("/api/pattern", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: prepared.data, mediaType: prepared.mediaType, notes: notesEl.value }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");

    if (!body.identified) {
      showError(body.summary || "I couldn't find an object to crochet in that photo. Try another one.");
    } else {
      renderPattern(body);
    }
  } catch (err) {
    showError(err.message || "Network error. Please try again.");
  } finally {
    clearInterval(ticker);
    loadingEl.hidden = true;
    generateBtn.disabled = false;
  }
});

// ---------- Render ----------

function renderPattern(p) {
  resultEl.innerHTML = "";

  resultEl.append(
    card(
      el("div", { class: "result-head" }, [
        el("h2", {}, p.item_name),
        el("p", { class: "summary" }, p.summary),
        el("ul", { class: "meta" }, [
          metaChip("Difficulty", p.difficulty),
          metaChip("Size", p.finished_size),
          metaChip("Time", p.estimated_time),
        ]),
      ])
    ),

    el("div", { class: "result-actions" }, [
      button("Print pattern", "btn btn-secondary", () => window.print()),
      button("Start over", "btn btn-secondary", () => {
        resultEl.hidden = true;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }),
    ]),

    card([
      el("h2", { class: "section-title" }, "Yarn"),
      el("div", { class: "grid-2" }, [
        el("dl", { class: "kv" }, [
          el("dt", {}, "Weight"), el("dd", {}, p.yarn.weight),
          el("dt", {}, "Fiber"), el("dd", {}, p.yarn.fiber),
        ]),
        el("p", { class: "why" }, p.yarn.why),
      ]),
      el("h3", {}, "Colors"),
      el("ul", { class: "colors" }, p.yarn.colors.map(colorRow)),
    ]),

    card([
      el("h2", { class: "section-title" }, "Hook & materials"),
      el("div", { class: "grid-2" }, [
        el("div", {}, [
          el("h3", {}, "Hook"),
          el("dl", { class: "kv" }, [
            el("dt", {}, "Size"), el("dd", {}, `${p.hook.size_mm} (US ${p.hook.size_us})`),
          ]),
          el("p", { class: "why" }, p.hook.why),
          el("h3", {}, "Gauge"),
          el("p", {}, p.gauge),
        ]),
        el("div", {}, [
          el("h3", {}, "You'll also need"),
          el("ul", { class: "materials" }, p.other_materials.map((m) =>
            el("li", {}, [m.item, m.note ? el("span", {}, ` — ${m.note}`) : ""])
          )),
        ]),
      ]),
    ]),

    card([
      el("h2", { class: "section-title" }, "Abbreviations"),
      el("ul", { class: "abbrs" }, p.abbreviations.map((a) =>
        el("li", {}, [el("b", {}, a.abbr), a.meaning])
      )),
    ]),

    instructionsCard(p.sections),
  );

  if (p.tips?.length) {
    resultEl.append(card([
      el("h2", { class: "section-title" }, "Tips"),
      el("ul", { class: "tips" }, p.tips.map((t) => el("li", {}, t))),
    ]));
  }

  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function instructionsCard(sections) {
  const total = sections.reduce((n, s) => n + s.steps.length, 0);
  const progressText = el("span", {}, `0 of ${total} steps done`);
  const bar = el("div");
  let done = 0;
  let stepId = 0;

  const onToggle = (li, checked) => {
    li.classList.toggle("done", checked);
    done += checked ? 1 : -1;
    progressText.textContent = `${done} of ${total} steps done`;
    bar.style.width = `${(done / total) * 100}%`;
  };

  return card([
    el("h2", { class: "section-title" }, "Step-by-step instructions"),
    el("div", { class: "progress" }, [progressText, el("div", { class: "progress-bar" }, [bar])]),
    ...sections.map((s) =>
      el("div", { class: "pattern-section" }, [
        el("h3", {}, [s.title, s.color ? el("span", { class: "color-tag" }, `Color: ${s.color}`) : ""]),
        el("ol", { class: "steps" }, s.steps.map((step) => {
          const id = `step-${stepId++}`;
          const li = el("li", { class: "step" });
          const box = el("input", { type: "checkbox", id });
          box.addEventListener("change", () => onToggle(li, box.checked));
          li.append(
            box,
            el("label", { for: id }, [
              step.label ? el("span", { class: "step-label" }, step.label) : "",
              step.instruction,
              step.stitch_count ? el("span", { class: "step-count" }, ` (${step.stitch_count})`) : "",
            ])
          );
          return li;
        })),
      ])
    ),
  ]);
}

function colorRow(c) {
  const hex = /^#[0-9a-f]{3,8}$/i.test(c.hex) ? c.hex : "#cccccc";
  return el("li", { class: "color" }, [
    el("span", { class: "swatch", style: `background:${hex}`, title: hex }),
    el("div", {}, [el("div", { class: "color-name" }, c.name), el("div", { class: "color-use" }, c.used_for)]),
    el("span", { class: "yardage" }, c.yardage),
  ]);
}

// ---------- Helpers ----------

// Builds elements with textContent only, so model output is never parsed as HTML.
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of [].concat(children)) {
    if (child == null || child === "") continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

const card = (children) => el("section", { class: "card" }, children);
const metaChip = (label, value) => el("li", {}, [el("b", {}, `${label}: `), value]);

function button(text, cls, onClick) {
  const b = el("button", { class: cls, type: "button" }, text);
  b.addEventListener("click", onClick);
  return b;
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}
