// IndexedDB init via Dexie
const db = new Dexie('kcal_local');
db.version(1).stores({
  foods: '++id,name,kcalPer100',
  intakes: '++id,date,foodId,grams,kcal',
  meta: '&key,value'
});

export async function getGoal() {
  const m = await db.meta.get('goal');
  return m?.value ?? null;
}
export async function setGoal(val) {
  await db.meta.put({ key:'goal', value: Number(val) || 0 });
}
export async function listFoods() { return db.foods.orderBy('name').toArray(); }
export async function addFood(name, kcalPer100) {
  name = name.trim();
  const exists = await db.foods.where('name').equalsIgnoreCase(name).first();
  if (exists) { await db.foods.update(exists.id, { kcalPer100:Number(kcalPer100) }); return exists.id; }
  return db.foods.add({ name, kcalPer100: Number(kcalPer100) });
}
export async function removeFood(id) {
  await db.intakes.where('foodId').equals(id).delete();
  await db.foods.delete(id);
}
export async function addIntake(dateISO, foodId, grams, kcal) {
  return db.intakes.add({ date: dateISO, foodId, grams: Number(grams), kcal: Number(kcal) });
}
export async function listIntakesByDate(dateISO) {
  return db.intakes.where('date').equals(dateISO).reverse().sortBy('id');
}
export async function deleteIntake(id) { return db.intakes.delete(id); }
export async function deleteAllByDate(dateISO) { return db.intakes.where('date').equals(dateISO).delete(); }

export async function exportAll() {
  const [foods, intakes, meta] = await Promise.all([db.foods.toArray(), db.intakes.toArray(), db.meta.toArray()]);
  return { version:1, exportedAt: new Date().toISOString(), foods, intakes, meta };
}
export async function importAll(json) {
  if (!json || json.version !== 1) throw new Error('Ismeretlen export formátum');
  await db.transaction('rw', db.foods, db.intakes, db.meta, async () => {
    await db.foods.clear(); await db.intakes.clear(); await db.meta.clear();
    await db.foods.bulkAdd(json.foods || []);
    await db.intakes.bulkAdd(json.intakes || []);
    await db.meta.bulkAdd(json.meta || []);
  });
}