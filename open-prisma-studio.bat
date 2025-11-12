@echo off
echo ========================================
echo Opening Prisma Studio Database Viewer
echo ========================================
echo.
echo This will:
echo 1. Set up SSH port forwarding
echo 2. Open Prisma Studio in your browser
echo.
echo Press Ctrl+C to stop the port forwarding
echo.
echo Starting SSH connection...
echo.

start "" "http://localhost:5555"

ssh -L 0.0.0.0:5555:localhost:5555 nwalchenbach@10.20.75.182

pause

