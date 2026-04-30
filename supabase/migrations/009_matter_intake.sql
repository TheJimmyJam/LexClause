-- ============================================================================
-- Migration 009 — matter intake from documents
--
-- Adds columns to lc_matters to track the source document a matter was
-- extracted from, plus a new storage bucket for those source files.
-- The edge function's extract_matter mode reads the PDF and pre-fills the
-- matter form for the user to confirm/edit before creating.
-- ============================================================================

alter table lc_matters
  add column if not exists source_document_filename text,
  add column if not exists source_document_path     text,
  add column if not exists source_document_type     text,    -- FNOL | reservation_of_rights | complaint | claim_summary | other
  add column if not exists raw_intake_extraction    jsonb;

-- Storage bucket for matter intake documents (FNOLs, ROR letters, complaints, etc.)
insert into storage.buckets (id, name, public)
values ('lc-matter-docs', 'lc-matter-docs', false)
on conflict (id) do nothing;

drop policy if exists "lc-matter-docs read"  on storage.objects;
drop policy if exists "lc-matter-docs write" on storage.objects;

create policy "lc-matter-docs read" on storage.objects for select
  using (
    bucket_id = 'lc-matter-docs'
    and (storage.foldername(name))[1]::uuid = lc_user_org()
  );
create policy "lc-matter-docs write" on storage.objects for insert
  with check (
    bucket_id = 'lc-matter-docs'
    and (storage.foldername(name))[1]::uuid = lc_user_org()
  );
