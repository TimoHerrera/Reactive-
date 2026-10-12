-- Reactive App · Storage de videos
-- Bucket privado: solo staff sube/borra; cualquier usuario logueado reproduce con URLs firmadas.
-- 50 MB = límite por archivo del plan gratis (ajustar junto con NEXT_PUBLIC_MAX_VIDEO_MB).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-videos',
  'exercise-videos',
  false,
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "exercise-videos: leer logueados" on storage.objects for select to authenticated
  using (bucket_id = 'exercise-videos');

create policy "exercise-videos: staff sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-videos' and public.is_staff());

create policy "exercise-videos: staff actualiza" on storage.objects for update to authenticated
  using (bucket_id = 'exercise-videos' and public.is_staff())
  with check (bucket_id = 'exercise-videos' and public.is_staff());

create policy "exercise-videos: staff borra" on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-videos' and public.is_staff());
