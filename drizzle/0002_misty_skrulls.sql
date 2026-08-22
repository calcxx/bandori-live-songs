ALTER TABLE "bands" ADD COLUMN "search_aliases" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
UPDATE "bands"
SET "search_aliases" = CASE "slug"
  WHEN 'poppin-party' THEN ARRAY['ppp', 'popipa', 'ポピパ']::text[]
  WHEN 'afterglow' THEN ARRAY['ag']::text[]
  WHEN 'pastel-palettes' THEN ARRAY['pp']::text[]
  WHEN 'hello-happy-world' THEN ARRAY['hhw']::text[]
  WHEN 'raise-a-suilen' THEN ARRAY['ras']::text[]
  WHEN 'morfonica' THEN ARRAY['monica', 'モニカ']::text[]
  WHEN 'mygo' THEN ARRAY['mygo']::text[]
  WHEN 'ave-mujica' THEN ARRAY['mujica']::text[]
  WHEN 'mugendai-mewtype' THEN ARRAY['梦限大', 'yumemita', 'ゆめみた']::text[]
  ELSE "search_aliases"
END;
