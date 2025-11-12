# Quick Guide: Access from Phone

## Step-by-Step Instructions

### 1. Connect to SSH Server with Port Forwarding

**On your laptop**, connect to your SSH server with port forwarding that allows external access:

```bash
ssh -L 0.0.0.0:3000:localhost:3000 your-username@your-server-ip
```

**Important:** Use `0.0.0.0:3000` (not just `3000`) to make it accessible from your phone.

### 2. Find Your Laptop's IP Address

**Windows (Command Prompt):**
```bash
ipconfig
```
Look for "IPv4 Address" - it will look like `192.168.x.x` or `10.0.x.x`

**Mac (Terminal):**
```bash
ipconfig getifaddr en0
```

**Linux (Terminal):**
```bash
hostname -I | awk '{print $1}'
```

### 3. Make Sure Dev Server is Running

On your SSH server, the dev server should be running:
```bash
cd /home/nwalchenbach/construction-reports
npm run dev
```

### 4. Access from Your Phone

1. **Connect your phone to the same WiFi as your laptop**
2. **Open a browser on your phone** (Chrome, Safari, etc.)
3. **Type in the address bar:**
   ```
   http://[your-laptop-ip]:3000
   ```
   Example: `http://192.168.1.105:3000`

### 5. Firewall Check (if it doesn't work)

**Windows:**
- Open Windows Defender Firewall
- Click "Allow an app through firewall"
- Allow Node.js or add port 3000

**Mac:**
- System Settings → Network → Firewall
- Make sure it allows connections

**Quick test:** Temporarily disable firewall to test if that's the issue

## Common Issues

**"Connection refused" or timeout:**
- Make sure SSH port forwarding is running with `0.0.0.0:3000`
- Check that both devices are on same WiFi
- Verify firewall allows port 3000

**"This site can't be reached":**
- Double-check your laptop's IP address
- Make sure you're using `http://` not `https://`
- Try `http://localhost:3000` on your laptop first to verify it works

**IP address changed:**
- Your laptop's IP may change when you reconnect to WiFi
- Find the new IP and update the URL on your phone



