// Genera planillas de ejemplo para probar la importación (docs/ejemplos/).
//   npx tsx scripts/generate-import-examples.ts
import * as XLSX from "xlsx";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const H = ["Día", "Bloque", "Orden", "Ejercicio", "Series", "Reps", "Carga", "Descanso", "Notas"];
const out = resolve(__dirname, "../docs/ejemplos");
mkdirSync(out, { recursive: true });

function save(name: string, rows: (string | number)[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Rutina");
  XLSX.writeFile(wb, resolve(out, name));
  console.log("✓", name);
}

// Caso feliz del diseño: reconocidos, «RDL c/ mancuernas» y «Copenhague» a revisar, «Salto al cajón unipodal» no encontrado.
save("readaptacion_martina_f2.xlsx", [
  H,
  ["A", "Entrada en calor", 1, "Movilidad de flexores de cadera", 2, "45 s c/lado", "Peso corporal", "15 s", "Glúteo apretado"],
  ["A", "Entrada en calor", 2, "Activación de tobillo con banda", 3, "15", "Banda media", "30 s", ""],
  ["A", "Principal", 3, "Sentadilla goblet", 4, "8", "16 kg", "90 s", "Rodillas en la línea de los pies"],
  ["A", "Principal", 4, "RDL c/ mancuernas", 4, "8", "2×14 kg", "90 s", ""],
  ["A", "Principal", 5, "Estocada búlgara", 3, "8 c/lado", "2×8 kg", "75 s", ""],
  ["A", "Principal", 6, "Nordic curl", 3, "5", "Banda", "2 min", ""],
  ["A", "Accesorios", 7, "Copenhague", 3, "20 s", "", "45 s", ""],
  ["A", "Core", 8, "Press pallof", 3, "10", "5 kg", "45 s", ""],
  ["A", "Accesorios", 9, "Salto al cajón unipodal", 3, "5", "", "60 s", ""],
  ["B", "Principal", 1, "Saltos laterales con estabilización", 4, "6 c/lado", "", "90 s", ""],
  ["B", "Principal", 2, "Flexiones de brazos", 3, "10", "", "60 s", ""],
  ["B", "Core", 3, "Plancha", 3, "30 s", "", "30 s", ""],
  ["C", "Principal", 1, "Hip thrust", 4, "10", "40 kg", "90 s", ""],
  ["C", "Principal", 2, "RDL", 3, "8", "2×14 kg", "90 s", ""],
  ["C", "Accesorios", 3, "Gemelos unipodal", 3, "12 c/lado", "", "45 s", ""],
]);

// Caso con errores del diseño: columna «Nombre», Series inválida y filas sin Día.
const bad: (string | number)[][] = [["Día", "Bloque", "Orden", "Nombre", "Series", "Reps", "Carga", "Descanso", "Notas"]];
for (let i = 0; i < 12; i++) bad.push(["A", "Principal", i + 1, "Sentadilla goblet", 3, "10", "", "60 s", ""]);
bad.push(["A", "Principal", 13, "Nordic", "tres o cuatro", "5", "", "", ""]); // fila 14
for (let i = 0; i < 5; i++) bad.push(["B", "Principal", i + 1, "Hip thrust", 3, "10", "", "", ""]);
for (let i = 0; i < 3; i++) bad.push(["", "Core", i + 1, "Plancha", 3, "30 s", "", "", ""]); // filas 20–22
save("rutina_sofia_LCA.xlsx", bad);

// Formato «por bloques» (una hoja por día), como arman muchos profes. Datos inventados.
function saveBook(name: string, sheets: Record<string, (string | number)[][]>) {
  const wb = XLSX.utils.book_new();
  for (const [sheet, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet);
  XLSX.writeFile(wb, resolve(out, name));
  console.log("✓", name);
}
const BH = (name: string) => [name, "Repeticiones", "Series", "Carga", "Pausa"];
saveBook("rutina_por_bloques.xlsx", {
  "Dia 1": [
    ["Rutina Ana Ejemplo"],
    ["Oct-26"],
    [],
    ["Movilidad misma de siempre"],
    [],
    BH("Entrada en calor"),
    ["Abdominales bisagra con disco", "12", "3", "5kg", ""],
    ["Plancha alta 3 apoyos", "15 segundos cada brazo", "3", "", ""],
    ["", "", "", "", "2 minutos"],
    [],
    BH("Bloque 1"),
    ["Sentadilla goblet", "8", "4", "16kg", ""],
    ["Hip trhust", "10", "4", "20kg", ""],
    ["", "", "", "", "2 minutos"],
  ],
  "Dia 2": [
    BH("Entrada en calor"),
    ["Plancha Copenhague", "15 segundos por lado", "3", "", ""],
    ["", "", "", "", "90 segundos"],
    [],
    BH("Bloque 1"),
    ["Flexiones de brazos", "8", "4", "", ""],
    ["Press de hombro con mancuernas", "8", "tres", "4kg", ""],
    ["", "", "", "", "2 minutos"],
  ],
  "Dia 3": [
    ["Activacion de cadera", "Repeticiones", "Series", "Pausa", ""],
    ["Banda lateral", "10 por pierna", "4", "", ""],
    ["", "", "", "2 minutos", ""],
  ],
});
