-- Allow upsert on conversation_metadata by session_id
ALTER TABLE public.conversation_metadata
  ADD CONSTRAINT conversation_metadata_session_id_key UNIQUE (session_id);
