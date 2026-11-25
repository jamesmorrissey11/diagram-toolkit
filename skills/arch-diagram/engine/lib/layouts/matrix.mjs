// Matrix: rows × columns with a value per cell. "yes" | "no" | "preview" | "partial" draw as preset glyphs (with an
// automatic key); any other string is drawn as-is. No nodes or edges.
const MEANING = { yes: "supported", no: "not supported", preview: "preview", partial: "partial" };
const PADX = 14, PADY = 9;

function validate(spec, bad) {
  const rows = spec.rows, cols = spec.cols;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 16) bad("matrix: rows must list 1..16 {id, label}");
  if (!Array.isArray(cols) || cols.length < 1 || cols.length > 10) bad("matrix: cols must list 1..10 {id, label}");
  if (!Array.isArray(rows) || !Array.isArray(cols)) return;
  for (const x of [...rows, ...cols]) if (typeof x.label !== "string" || !x.label.trim() || x.label.length > 32) bad(`matrix: ${x.id} label required, <= 32 chars`);
  const seen = new Set();
  for (const x of [...rows, ...cols]) {
    if (typeof x.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(x.id)) bad(`matrix: id ${JSON.stringify(x.id)} invalid; use letters, digits, - and _`);
    else if (seen.has(x.id)) bad(`matrix: id "${x.id}" duplicate; row and column ids must be unique`);
    seen.add(x.id);
  }
  const R = new Set(rows.map((r) => r.id)), C = new Set(cols.map((c) => c.id));
  for (const [k, v] of Object.entries(spec.cells ?? {})) {
    const [r, c] = k.split("/");
    if (!R.has(r) || !C.has(c)) bad(`matrix: cell "${k}" names an unknown row or column`);
    if (typeof v !== "string" || !v.trim() || v.length > 24) bad(`matrix: cell "${k}" must be a non-empty string <= 24 chars (omit the key for a blank cell)`);
  }
  if (spec.nodes.length || spec.edges.length) bad("matrix: nodes and edges are not used; put values in cells");
}

const glyph = (preset, v) => preset.matrix.glyphs[v];
const cellText = (preset, v) => glyph(preset, v)?.text ?? v;
function keyText(spec, preset) {
  const used = [...new Set(Object.values(spec.cells ?? {}))].filter((v) => glyph(preset, v));
  return used.length ? used.map((v) => `${glyph(preset, v).text} ${MEANING[v]}`).join("   ·   ") : null;
}
function texts(spec, preset) {
  const S = preset.size, out = [...spec.rows.map((r) => [r.label, S.sub]), ...spec.cols.map((c) => [c.label, S.sub])];
  for (const v of Object.values(spec.cells ?? {})) out.push([cellText(preset, v), glyph(preset, v) ? S.label : S.sub]);
  const k = keyText(spec, preset);
  if (k) out.push([k, S.sub]);
  return out;
}

function compose(spec, geo, preset) {
  const S = preset.size, tw = geo.tw, lh = (s) => Math.ceil(s * preset.font.lineHeight);
  const cell = (r, c) => spec.cells?.[`${r.id}/${c.id}`];
  const headW = Math.max(...spec.rows.map((r) => tw(r.label, S.sub))) + 2 * PADX;
  const colW = spec.cols.map((c) => Math.max(tw(c.label, S.sub), ...spec.rows.map((r) => { const v = cell(r, c); return v ? tw(cellText(preset, v), glyph(preset, v) ? S.label : S.sub) : 0; })) + 2 * PADX);
  const rowH = lh(S.label) + 2 * PADY, headH = lh(S.sub) + 2 * PADY;
  const decor = [];
  let x = headW;
  const colX = colW.map((w) => { const v = x; x += w; return v; });
  const W = x;
  spec.cols.forEach((c, j) => {
    decor.push({ kind: "rect", id: `colh_${c.id}`, x: colX[j], y: 0, w: colW[j], h: headH, style: "header", rounded: false });
    const t = tw(c.label, S.sub);
    decor.push({ kind: "text", id: `colt_${c.id}`, text: c.label, x: Math.round(colX[j] + (colW[j] - t) / 2), y: PADY, w: t, size: "sub", style: "header" });
  });
  spec.rows.forEach((r, i) => {
    const y = headH + i * rowH;
    decor.push({ kind: "rect", id: `rowh_${r.id}`, x: 0, y, w: headW, h: rowH, style: "header", rounded: false });
    decor.push({ kind: "text", id: `rowt_${r.id}`, text: r.label, x: PADX, y: Math.round(y + (rowH - lh(S.sub)) / 2), w: tw(r.label, S.sub), size: "sub", style: "header" });
    spec.cols.forEach((c, j) => {
      decor.push({ kind: "rect", id: `cell_${r.id}_${c.id}`, x: colX[j], y, w: colW[j], h: rowH, style: "cell", rounded: false });
      const v = cell(r, c);
      if (!v) return;
      const g = glyph(preset, v), size = g ? "label" : "sub", t = tw(cellText(preset, v), S[size]);
      decor.push({ kind: "text", id: `cellt_${r.id}_${c.id}`, text: cellText(preset, v), x: Math.round(colX[j] + (colW[j] - t) / 2),
        y: Math.round(y + (rowH - lh(S[size])) / 2), w: t, size, style: "cell", color: g?.color });
    });
  });
  const k = keyText(spec, preset);
  if (k) decor.push({ kind: "text", id: "key", text: k, x: 0, y: headH + spec.rows.length * rowH + 14, w: tw(k, S.sub), size: "sub", style: "header" });
  return { nodes: {}, groups: {}, titleAlign: {}, routes: {}, fallbacks: [], decor, width: W };
}

function check(spec, scene) {
  const have = new Set(scene.elements.filter((e) => e.customData?.dt?.kind === "decorText").map((e) => e.customData.dt.id));
  const hard = Object.keys(spec.cells ?? {}).map((k) => `cellt_${k.replace("/", "_")}`).filter((id) => !have.has(id)).map((id) => `text-dropped:${id}`);
  return { hard, warnings: spec.rows.filter((r) => !spec.cols.some((c) => spec.cells?.[`${r.id}/${c.id}`])).map((r) => `matrix row ${r.id} is empty`) };
}

export default { name: "matrix", validate, texts, compose, check, aspect: [0.3, 4], nodesOptional: true };
