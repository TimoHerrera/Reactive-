import { redirect } from "next/navigation";

// La gestión de profes ahora vive en «Equipo».
export default function ProfesPage() {
  redirect("/coach/equipo");
}
