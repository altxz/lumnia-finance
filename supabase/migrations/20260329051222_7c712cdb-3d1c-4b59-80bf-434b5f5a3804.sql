
-- Step 1: Reassign children of duplicate parent categories to the "keeper" (the one with most children / oldest)
WITH ranked AS (
  SELECT 
    c.id,
    c.user_id,
    c.name,
    c.parent_id,
    (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) as child_count,
    c.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY c.user_id, c.name, COALESCE(c.parent_id::text, '__NULL__')
      ORDER BY (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) DESC, c.created_at ASC
    ) as rn
  FROM categories c
),
keepers AS (
  SELECT id, user_id, name, parent_id FROM ranked WHERE rn = 1
),
duplicates AS (
  SELECT r.id as dup_id, k.id as keep_id
  FROM ranked r
  JOIN keepers k ON k.user_id = r.user_id AND k.name = r.name 
    AND COALESCE(k.parent_id::text, '__NULL__') = COALESCE(r.parent_id::text, '__NULL__')
  WHERE r.rn > 1
)
UPDATE categories SET parent_id = d.keep_id
FROM duplicates d
WHERE categories.parent_id = d.dup_id;

-- Step 2: Reassign expenses referencing duplicate category names (no action needed since expenses use final_category text, not FK)

-- Step 3: Delete duplicate categories (keeping only rn=1)
WITH ranked AS (
  SELECT 
    c.id,
    c.user_id,
    c.name,
    c.parent_id,
    ROW_NUMBER() OVER (
      PARTITION BY c.user_id, c.name, COALESCE(c.parent_id::text, '__NULL__')
      ORDER BY (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) DESC, c.created_at ASC
    ) as rn
  FROM categories c
)
DELETE FROM categories
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 4: Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_parent_unique 
ON categories (user_id, name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'));
