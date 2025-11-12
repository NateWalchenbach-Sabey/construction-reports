#!/bin/bash
# Quick script to connect to PostgreSQL database

echo "Connecting to PostgreSQL database..."
echo "Database: construction_reports"
echo "User: construction_user"
echo ""

# Method 1: Using connection string
psql "postgresql://construction_user:construction_password@localhost:5432/construction_reports"

# Alternative method (if the above doesn't work):
# PGPASSWORD=construction_password psql -h localhost -U construction_user -d construction_reports

