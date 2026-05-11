-- ============================================================
-- Migration v10 — Enhanced Inventory + Supply Kits
-- ============================================================

-- 1. Add new columns to inventory
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS unit_cost        numeric(10,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS supplier_name    text           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS supplier_contact text           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS supplier_code    text           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expiry_date      date           DEFAULT NULL;

-- 2. Add cost_per_unit to inventory_usage so we snapshot the price at time of use
ALTER TABLE inventory_usage
  ADD COLUMN IF NOT EXISTS cost_per_unit numeric(10,2) DEFAULT NULL;

-- 3. Supply kits table (admin-defined bundles of inventory items)
CREATE TABLE IF NOT EXISTS supply_kits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. Supply kit line items
CREATE TABLE IF NOT EXISTS supply_kit_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id      uuid NOT NULL REFERENCES supply_kits(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES inventory(id)   ON DELETE CASCADE,
  quantity    numeric(10,3) NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kit_id, item_id)
);

-- 5. RLS — supply_kits readable by authenticated users, writable by admins
ALTER TABLE supply_kits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supply_kits_read"  ON supply_kits;
DROP POLICY IF EXISTS "supply_kits_write" ON supply_kits;
CREATE POLICY "supply_kits_read"  ON supply_kits FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "supply_kits_write" ON supply_kits FOR ALL    USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

ALTER TABLE supply_kit_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supply_kit_items_read"  ON supply_kit_items;
DROP POLICY IF EXISTS "supply_kit_items_write" ON supply_kit_items;
CREATE POLICY "supply_kit_items_read"  ON supply_kit_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "supply_kit_items_write" ON supply_kit_items FOR ALL    USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- 6. Seed some escalator-cleaning-specific categories as a comment reference
-- Categories now used in app: Cleaning Chemicals | Degreasers | PPE | Tools |
--   Safety Equipment | Lubricants | Consumables | Equipment | Other
