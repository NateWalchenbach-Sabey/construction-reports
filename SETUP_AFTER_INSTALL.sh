#!/bin/bash
# Run this AFTER PostgreSQL is installed
# This script sets up the database schema and seeds data

cd /home/nwalchenbach/construction-reports

echo "🔧 Step 1: Generating Prisma Client..."
npm run db:generate

echo ""
echo "📊 Step 2: Creating database tables..."
npm run db:push

echo ""
echo "🌱 Step 3: Seeding database with sample data..."
npm run db:seed

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Database setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔄 Restarting server..."
pkill -f "next dev" 2>/dev/null
sleep 2
npm run dev &
sleep 5

echo ""
echo "🎉 Setup complete! Open http://localhost:3000"
echo ""
echo "Login with:"
echo "  • Admin: admin@example.com / admin123"
echo "  • Superintendent: super1@example.com / super123"
echo "  • PM: pm1@example.com / pm123"
echo ""

