"use client";

import { useParams } from "next/navigation";
import { ExerciseForm } from "@/components/coach/ExerciseForm";
import { Loading } from "@/components/Loading";
import { PillButton } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

export default function EditExercisePage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "nuevo";
  // Solo se carga una vez: el formulario maneja su propio estado y autoguarda.
  const exercise = useQuery(() => (isNew ? Promise.resolve(null) : data.exercises.get(id)), [id]);

  if (isNew) return <ExerciseForm />;
  if (exercise.loading && exercise.data === undefined) return <Loading />;
  if (!exercise.data) {
    return (
      <div className="px-gutter pt-16 text-center">
        <p className="display text-h1">Ejercicio no encontrado</p>
        <PillButton href="/coach/ejercicios" variant="inverse" className="mt-8">
          Volver
        </PillButton>
      </div>
    );
  }
  return <ExerciseForm key={exercise.data.id} exercise={exercise.data} />;
}
