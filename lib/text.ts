/** Minúsculas, sin acentos, sin puntuación y con espacios colapsados. «RDL c/ Mancuernas» → «rdl c mancuernas». */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Como normalizeText pero conserva la puntuación; útil para encabezados de columnas. */
export function normalizeHeader(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
