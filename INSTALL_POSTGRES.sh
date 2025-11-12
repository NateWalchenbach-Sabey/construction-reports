#!/bin/bash
# PostgreSQL Installation and Setup Script for Construction Reports

echo "🚀 Installing PostgreSQL..."
sudo apt update
sudo apt install -y postgresql postgresql-contrib

echo ""
echo "✅ PostgreSQL installed!"
echo ""
echo "🔄 Starting PostgreSQL service..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

echo ""
echo "📊 Creating database and user..."
sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE construction_reports;

-- Create user
CREATE USER construction_user WITH PASSWORD 'construction_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE construction_reports TO construction_user;

-- Connect to database and grant schema privileges
\c construction_reports
GRANT ALL ON SCHEMA public TO construction_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO construction_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO construction_user;

\q
EOF

echo ""
echo "✅ Database setup complete!"
echo ""
echo "🔍 Verifying setup..."
sudo -u postgres psql -c "\l" | grep construction_reports && echo "✅ Database exists" || echo "❌ Database not found"
sudo -u postgres psql -c "\du" | grep construction_user && echo "✅ User exists" || echo "❌ User not found"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PostgreSQL is ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  cd /home/nwalchenbach/construction-reports"
echo "  npm run db:generate"
echo "  npm run db:push"
echo "  npm run db:seed"
echo ""

