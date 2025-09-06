import { getGoal, setGoal, listFoods, addFood, removeFood, addIntake, listIntakesByDate, deleteIntake, deleteAllByDate, exportAll, importAll } from './db.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n);
function todayISO() { return new Date().toISOString().slice(0,10); }

async function ensureSeedFoods() {
  const existing = await listFoods();
  if (existing.length) return;
  const res = await fetch('./foods.json');
  const foods = await res.json();
  for (const f of foods) await addFood(f.name, f.kcalPer100);
}

async function refreshFoodsUI() {
  const foods = await listFoods();
  const sel = $('foodSelect'); sel.innerHTML = '';
  for (const f of foods) {
    const opt = document.createElement('option');
    opt.value = f.id; opt.textContent = `${f.name} (${f.kcalPer100} kcal/100g)`;
    sel.appendChild(opt);
  }
  const tbl = $('foodsTable');
  tbl.innerHTML = '<tr><th>Név</th><th>kcal/100g</th><th></th></tr>';
  for (const f of foods) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${f.name}</td><td>${f.kcalPer100}</td>
    <td><button data-del="${f.id}">Törlés</button></td>`;
    tbl.appendChild(tr);
  }
  tbl.querySelectorAll('button[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => { await removeFood(Number(btn.dataset.del)); await refreshFoodsUI(); await refreshEntriesUI(); });
  });
}

async function refreshEntriesUI() {
  const dateISO = $('datePicker').value || todayISO();
  const entries = await listIntakesByDate(dateISO);
  const tbl = $('entriesTable');
  tbl.innerHTML = '<tr><th>Étel</th><th>Gramm</th><th>kcal</th><th></th></tr>';
  let sum = 0;
  const foods = await listFoods();
  const byId = new Map(foods.map(f => [f.id, f]));
  for (const e of entries) {
    sum += e.kcal;
    const f = byId.get(e.foodId);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${f?.name ?? 'Ismeretlen'}</td><td>${e.grams}</td><td>${fmt(e.kcal)}</td>
      <td><button data-del-entry="${e.id}">X</button></td>`;
    tbl.appendChild(tr);
  }
  const goal = Number(await getGoal()) || 0;
  const remain = goal ? goal - sum : null;
  const summary = $('summary');
  summary.innerHTML = `
    <div class="goal">Napi összes: <strong>${fmt(sum)} kcal</strong>${goal ? ` / Cél: <strong>${goal} kcal</strong>` : ''}</div>
    ${goal ? `<div class="${remain >= 0 ? 'ok':'warn'}">${remain >= 0 ? `Még ${fmt(remain)} kcal fér bele.` : `Túllépted ${fmt(-remain)} kcal-lal.`}</div>` : '<div class="muted">Állíts be napi célt a fejlécben.</div>'}
  `;
  tbl.querySelectorAll('button[data-del-entry]').forEach(btn => {
    btn.addEventListener('click', async () => { await deleteIntake(Number(btn.dataset.delEntry)); await refreshEntriesUI(); });
  });
}

function calcPreview() {
  const sel = $('foodSelect');
  const grams = Number($('grams').value || 0);
  const kcalPer100 = sel.selectedOptions[0]?.textContent.match(/\((\d+)\s*kcal/)?.[1];
  if (!kcalPer100 || !grams) { $('calcPreview').textContent = 'Írj be grammot…'; return; }
  const kcal = grams * Number(kcalPer100) / 100;
  $('calcPreview').textContent = `≈ ${fmt(kcal)} kcal`;
}

async function init() {
  $('datePicker').valueAsDate = new Date();
  await ensureSeedFoods();
  await refreshFoodsUI();
  await refreshEntriesUI();
  $('grams').addEventListener('input', calcPreview);
  $('foodSelect').addEventListener('change', calcPreview);
  $('addIntake').addEventListener('click', async () => {
    const dateISO = $('datePicker').value || todayISO();
    const foodId = Number($('foodSelect').value);
    const grams = Number($('grams').value || 0);
    if (!foodId || !grams) return;
    const selectedText = $('foodSelect').selectedOptions[0].textContent;
    const kcalPer100 = Number(selectedText.match(/\((\d+)\s*kcal/)?.[1] || 0);
    const kcal = grams * kcalPer100 / 100;
    await addIntake(dateISO, foodId, grams, kcal);
    $('grams').value = ''; calcPreview(); await refreshEntriesUI();
  });
  $('saveGoal').addEventListener('click', async () => { await setGoal(Number($('goal').value || 0)); await refreshEntriesUI(); });
  const g = await getGoal(); if (g) $('goal').value = g;
  $('todayBtn').addEventListener('click', () => { $('datePicker').valueAsDate = new Date(); refreshEntriesUI(); });
  $('delAllToday').addEventListener('click', async () => {
    const dateISO = $('datePicker').value || todayISO();
    if (confirm('Biztosan törlöd a mai tételeket?')) { await deleteAllByDate(dateISO); await refreshEntriesUI(); }
  });
  $('addFoodBtn').addEventListener('click', async () => {
    const name = prompt('Étel neve (pl. Rizs főtt)');
    if (!name) return;
    const kcal = Number(prompt('kcal / 100 g?') || 0);
    if (!kcal) return;
    await addFood(name, kcal);
    await refreshFoodsUI();
  });
  $('exportBtn').addEventListener('click', async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kcal-local-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  });
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const txt = await file.text();
    try { await importAll(JSON.parse(txt)); alert('Import kész'); location.reload(); }
    catch (err) { alert('Import hiba: ' + err.message); }
  });
}
document.addEventListener('DOMContentLoaded', init);