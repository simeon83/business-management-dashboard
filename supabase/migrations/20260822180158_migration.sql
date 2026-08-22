CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'viewer')

CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  subscription_tier VARCHAR(50) DEFAULT 'basic',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE IF NOT EXISTS business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'viewer',
  full_name VARCHAR(255),
  email VARCHAR(255),
  permissions JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id, user_id)
)

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  customer_type VARCHAR(50) DEFAULT 'regular',
  credit_limit DECIMAL(12,2) DEFAULT 0,
  total_purchases DECIMAL(12,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100),
  category VARCHAR(100),
  unit_price DECIMAL(12,2) NOT NULL,
  cost_price DECIMAL(12,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_on_hand INT DEFAULT 0,
  reorder_level INT DEFAULT 10,
  reorder_quantity INT DEFAULT 50,
  last_counted_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id, product_id)
)

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  sale_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL
)

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'recorded',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  changes JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE INDEX idx_businesses_slug ON businesses(slug)

CREATE INDEX idx_business_users_business_id ON business_users(business_id)

CREATE INDEX idx_business_users_user_id ON business_users(user_id)

CREATE INDEX idx_customers_business_id ON customers(business_id)

CREATE INDEX idx_products_business_id ON products(business_id)

CREATE INDEX idx_inventory_business_id ON inventory(business_id)

CREATE INDEX idx_sales_business_id ON sales(business_id)

CREATE INDEX idx_sales_customer_id ON sales(customer_id)

CREATE INDEX idx_expenses_business_id ON expenses(business_id)

CREATE INDEX idx_audit_logs_business_id ON audit_logs(business_id)

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY

ALTER TABLE business_users ENABLE ROW LEVEL SECURITY

ALTER TABLE customers ENABLE ROW LEVEL SECURITY

ALTER TABLE products ENABLE ROW LEVEL SECURITY

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY

ALTER TABLE sales ENABLE ROW LEVEL SECURITY

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY

CREATE POLICY "Users can view their businesses" ON businesses FOR SELECT USING (id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()))

CREATE POLICY "Users can view business_users for their businesses" ON business_users FOR SELECT USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()))

CREATE POLICY "Users can view customers in their businesses" ON customers FOR SELECT USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()))

CREATE POLICY "Users can view products in their businesses" ON products FOR SELECT USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()))

CREATE POLICY "Users can view inventory in their businesses" ON inventory FOR SELECT USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()))

CREATE POLICY "Users can view sales in their businesses" ON sales FOR SELECT USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()))

CREATE POLICY "Users can view sale_items in their businesses" ON sale_items FOR SELECT USING (sale_id IN (SELECT id FROM sales WHERE business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid())))

CREATE POLICY "Users can view expenses in their businesses" ON expenses FOR SELECT USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()))

CREATE POLICY "Users can view audit_logs in their businesses" ON audit_logs FOR SELECT USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()))