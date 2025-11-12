# How to Access Prisma Studio in Cursor Browser

## The Problem
Cursor's browser runs on your **local machine**, but Prisma Studio is running on the **remote SSH server**. We need to forward port 5555 from the server to your local machine.

## Solution: Set Up Port Forwarding in Cursor

### Method 1: Using Cursor's Ports Panel (Easiest)

1. **Open the Ports panel in Cursor:**
   - Look for a "PORTS" tab in the bottom panel
   - Or go to: **View → Ports** (or press `Ctrl+Shift+P` and search "Ports")

2. **Add a new port forward:**
   - Click the **"+"** button or **"Forward a Port"**
   - Enter: `5555`
   - Press Enter

3. **Configure the forward:**
   - It should automatically forward `localhost:5555` (remote) → `localhost:5555` (local)
   - You should see it appear in the list with a status like "Forwarded"

4. **Open in browser:**
   - Right-click on the forwarded port 5555
   - Select **"Open in Browser"** or click the globe icon
   - Or manually go to: `http://localhost:5555`

### Method 2: Using Command Palette

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type: `Remote: Forward Port`
3. Enter: `5555`
4. Press Enter
5. Open `http://localhost:5555` in Cursor's browser

### Method 3: Manual Port Forwarding (If above doesn't work)

If Cursor's port forwarding doesn't work, you can manually set it up:

1. **In a separate terminal on your local machine** (not in Cursor):
   ```bash
   ssh -L 5555:localhost:5555 nwalchenbach@10.20.75.182
   ```

2. **Keep that terminal open**, then in Cursor's browser go to:
   ```
   http://localhost:5555
   ```

## Verify Prisma Studio is Running

On the server, Prisma Studio should be running on port 5555. You can verify by running this in Cursor's terminal:

```bash
curl http://localhost:5555
```

If you see HTML output, it's working!

## Troubleshooting

**"Connection Refused" in Cursor browser:**
- Make sure port forwarding is set up (Method 1 or 2 above)
- Verify Prisma Studio is running: `ps aux | grep "prisma studio"`
- Try restarting the port forward in Cursor

**Port already in use:**
- Close any other applications using port 5555
- Or forward to a different local port (e.g., 5556)

**Still not working:**
- Try Method 3 (manual SSH port forwarding)
- Or access via the server's IP: `http://10.20.75.182:5555` (if your network allows)

