"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Avatar } from "@/components/ui";
import { data } from "@/lib/data";

/** URL reproducible de una foto guardada en Storage (firmada en Supabase, blob local en mock). */
export function useStorageUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!path) return;
    data.videos
      .getUrl(path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

/** Avatar de un perfil: foto si tiene, si no las iniciales. */
export function ProfileAvatar({ avatarPath, ...rest }: Omit<ComponentProps<typeof Avatar>, "src"> & { avatarPath?: string | null }) {
  const src = useStorageUrl(avatarPath);
  return <Avatar {...rest} src={src} />;
}
