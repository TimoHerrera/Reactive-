"use client";

import { useEffect, useState } from "react";
import { data } from "@/lib/data";

/** URL reproducible para un path del bucket (firmada en Supabase, objectURL en mock). */
export function useVideoUrl(path: string | null | undefined): { url: string | null; loading: boolean } {
  const [state, setState] = useState<{ url: string | null; loading: boolean }>({ url: null, loading: !!path });
  useEffect(() => {
    let alive = true;
    if (!path) {
      setState({ url: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    data.videos
      .getUrl(path)
      .then((url) => alive && setState({ url, loading: false }))
      .catch(() => alive && setState({ url: null, loading: false }));
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
}
