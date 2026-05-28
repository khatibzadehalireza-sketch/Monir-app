-- ============================================================
-- Migration: post image uploads
-- Date: 2026-05-28  |  ADDITIVE ONLY
-- ============================================================

-- Add image_url column to posts (nullable — existing posts have no image)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create post-images storage bucket (public so images are readable without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read images
DO $$ BEGIN
  CREATE POLICY "post_images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'post-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: only authenticated users can upload
DO $$ BEGIN
  CREATE POLICY "post_images_auth_insert" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'post-images'
      AND auth.role() = 'authenticated'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: users can only delete their own images (stored under {user_id}/...)
DO $$ BEGIN
  CREATE POLICY "post_images_owner_delete" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'post-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
