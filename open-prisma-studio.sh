#!/bin/bash

echo "========================================"
echo "Opening Prisma Studio Database Viewer"
echo "========================================"
echo ""
echo "This will:"
echo "1. Set up SSH port forwarding"
echo "2. Open Prisma Studio in your browser"
echo ""
echo "Press Ctrl+C to stop the port forwarding"
echo ""
echo "Starting SSH connection..."
echo ""

# Open browser (works on Windows with Git Bash if default browser is set)
if command -v start &> /dev/null; then
    start http://localhost:5555 2>/dev/null &
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5555 2>/dev/null &
elif command -v open &> /dev/null; then
    open http://localhost:5555 2>/dev/null &
fi

# Set up port forwarding
ssh -L 0.0.0.0:5555:localhost:5555 nwalchenbach@10.20.75.182

