#!/bin/bash

echo "🚀 AI Visibility Tool - Quick Setup Script"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your credentials!"
    echo "   - MySQL password"
    echo "   - OpenAI API key"
    echo ""
    read -p "Press enter when done..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check MySQL connection
echo "🔍 Checking MySQL connection..."
if command -v mysql &> /dev/null; then
    echo "✅ MySQL is installed"
else
    echo "❌ MySQL not found. Please install MySQL first."
    exit 1
fi

# Run database schema
echo "🗄️  Setting up database..."
echo "Please enter your MySQL root password:"
mysql -u root -p < database-schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Database created successfully!"
else
    echo "❌ Database setup failed. Please check your MySQL credentials."
    exit 1
fi

# Seed prompts
echo "🌱 Seeding default prompts..."
npm run seed

if [ $? -eq 0 ]; then
    echo "✅ Prompts seeded successfully!"
else
    echo "❌ Seeding failed. Please check the error above."
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "To start the application:"
echo "  npm run start:dev"
echo ""
echo "API will be available at:"
echo "  http://localhost:3000/api"
echo ""
echo "Check README.md for API endpoints and testing instructions."
echo ""
