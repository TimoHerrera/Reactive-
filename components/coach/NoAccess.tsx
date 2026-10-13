import { PillButton } from "@/components/ui";

/** Recurso ajeno o inexistente (por URL): no se distingue cuál de los dos, a propósito. */
export function NoAccess({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="px-gutter pt-16 text-center" role="alert">
      <p className="display text-h1">No tenés acceso</p>
      <p className="mt-3 text-muted">{text}</p>
      <PillButton href={href} variant="inverse" className="mt-8">
        {label}
      </PillButton>
    </div>
  );
}
