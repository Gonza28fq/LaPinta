CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TYPE user_role AS ENUM ('owner','manager','waiter','cashier','kitchen','bartender');
CREATE TYPE theme_preference AS ENUM ('dark_bw','slate_blue','green_black');
CREATE TYPE table_status AS ENUM ('available','occupied','reserved','cleaning');
CREATE TYPE order_status AS ENUM ('pending','confirmed','in_kitchen','ready','delivered','billed','cancelled');
CREATE TYPE payment_method AS ENUM ('cash','card','transfer','qr');
CREATE TYPE product_category AS ENUM ('burger','sandwich','pizza','papas','bebida','trago','postre','extra','otro');

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL, email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role user_role NOT NULL DEFAULT 'waiter',
  theme theme_preference NOT NULL DEFAULT 'slate_blue',
  avatar_initials VARCHAR(3), is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  hourly_rate NUMERIC(10,2), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number INTEGER UNIQUE NOT NULL, capacity INTEGER NOT NULL DEFAULT 4,
  status table_status NOT NULL DEFAULT 'available', zone VARCHAR(50),
  shape VARCHAR(20) NOT NULL DEFAULT 'square',
  pos_x INTEGER NOT NULL DEFAULT 60, pos_y INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL, phone VARCHAR(30), email VARCHAR(150), notes TEXT,
  visit_count INTEGER NOT NULL DEFAULT 0, total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL, description TEXT, category product_category NOT NULL,
  current_price NUMERIC(10,2) NOT NULL, cost_price NUMERIC(10,2),
  is_available BOOLEAN NOT NULL DEFAULT TRUE, is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price NUMERIC(10,2) NOT NULL, new_price NUMERIC(10,2) NOT NULL,
  change_pct NUMERIC(6,2), reason VARCHAR(200),
  changed_by UUID NOT NULL REFERENCES users(id), changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS price_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description VARCHAR(200) NOT NULL, percentage NUMERIC(6,2) NOT NULL,
  category product_category, products_affected INTEGER,
  applied_by UUID NOT NULL REFERENCES users(id), applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS product_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(80) NOT NULL, price NUMERIC(8,2) NOT NULL DEFAULT 0,
  category VARCHAR(50), is_available BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES tables(id), customer_id UUID REFERENCES customers(id),
  customer_name VARCHAR(100), waiter_id UUID NOT NULL REFERENCES users(id),
  cashier_id UUID REFERENCES users(id), status order_status NOT NULL DEFAULT 'pending',
  order_type VARCHAR(20) NOT NULL DEFAULT 'mesa', delivery_address TEXT,
  notes TEXT, subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0, total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ, kitchen_at TIMESTAMPTZ, ready_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ, billed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(100) NOT NULL, unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1, subtotal NUMERIC(12,2) NOT NULL,
  notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS order_item_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  extra_id UUID NOT NULL REFERENCES product_extras(id),
  extra_name VARCHAR(80) NOT NULL, price NUMERIC(8,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  cashier_id UUID NOT NULL REFERENCES users(id),
  method payment_method NOT NULL, amount NUMERIC(12,2) NOT NULL,
  tip NUMERIC(10,2) NOT NULL DEFAULT 0, notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS cash_closings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cashier_id UUID NOT NULL REFERENCES users(id), manager_id UUID REFERENCES users(id),
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0, closing_amount NUMERIC(12,2),
  total_cash NUMERIC(12,2), total_card NUMERIC(12,2),
  total_transfer NUMERIC(12,2), total_qr NUMERIC(12,2),
  total_tips NUMERIC(12,2), orders_count INTEGER, notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), closed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS work_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(), clock_out TIMESTAMPTZ,
  hours_worked NUMERIC(6,2), notes TEXT
);
CREATE TABLE IF NOT EXISTS monthly_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  period_month INTEGER NOT NULL, period_year INTEGER NOT NULL,
  total_hours NUMERIC(8,2), hourly_rate NUMERIC(10,2),
  base_salary NUMERIC(12,2), bonuses NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0, total_pay NUMERIC(12,2),
  paid BOOLEAN NOT NULL DEFAULT FALSE, paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES users(id), notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_month, period_year)
);
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL, title VARCHAR(150) NOT NULL, body TEXT,
  role_target user_role, user_target UUID REFERENCES users(id),
  order_id UUID REFERENCES orders(id), table_id UUID REFERENCES tables(id),
  read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table   ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_waiter  ON orders(waiter_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_price_history  ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_work_shifts    ON work_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_upd    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  CREATE TRIGGER trg_tables_upd   BEFORE UPDATE ON tables   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  CREATE TRIGGER trg_products_upd BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  CREATE TRIGGER trg_orders_upd   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  CREATE TRIGGER trg_customers_upd BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
