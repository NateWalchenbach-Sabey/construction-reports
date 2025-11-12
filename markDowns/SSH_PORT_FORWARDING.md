# Accessing the App via SSH Port Forwarding

Since you're developing on a remote server via SSH, you need to set up port forwarding to access the app from your local laptop.

## Option 1: SSH Port Forwarding (Recommended)

When you connect to your SSH server, add port forwarding:

### One-time connection:
```bash
ssh -L 3000:localhost:3000 your-username@your-server-ip
```

### If using SSH config file:
Add this to your `~/.ssh/config` on your **local laptop**:

```
Host your-server-name
    HostName your-server-ip-or-hostname
    User your-username
    LocalForward 3000 localhost:3000
```

Then just connect normally: `ssh your-server-name`

### Access from your laptop:
Once connected with port forwarding, open your browser on your **local laptop** and go to:
```
http://localhost:3000
```

## Option 2: Forward to a different local port

If port 3000 is already in use on your laptop:

```bash
ssh -L 8080:localhost:3000 your-username@your-server-ip
```

Then access: `http://localhost:8080`

## Option 3: Access from Phone (Recommended)

To access from your phone or any device on your laptop's WiFi network:

### Step 1: Set up SSH port forwarding (binds to all interfaces)
```bash
ssh -L 0.0.0.0:3000:localhost:3000 your-username@your-server-ip
```

**Important:** The `0.0.0.0` makes it accessible from other devices on your laptop's network, not just localhost.

### Step 2: Find your laptop's IP address

**On your laptop (Windows):**
```bash
ipconfig
```
Look for "IPv4 Address" under your WiFi adapter (usually something like `192.168.x.x` or `10.0.x.x`)

**On your laptop (Mac/Linux):**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```
Or:
```bash
ipconfig getifaddr en0  # Mac
hostname -I | awk '{print $1}'  # Linux
```

### Step 3: Access from your phone

1. Make sure your phone is on the **same WiFi network** as your laptop
2. Open a browser on your phone
3. Go to: `http://[your-laptop-ip]:3000`
   - Example: `http://192.168.1.100:3000`

### Step 4: Firewall (if needed)

You may need to allow incoming connections on port 3000:

**Windows:**
- Windows Defender Firewall → Allow an app → Allow Node.js or allow port 3000

**Mac:**
- System Settings → Network → Firewall → Options → Allow incoming connections for Terminal/SSH

**Linux:**
```bash
sudo ufw allow 3000/tcp
```

## Verify the Dev Server is Running

On your SSH server, make sure the dev server is running:
```bash
cd /home/nwalchenbach/construction-reports
npm run dev
```

You should see something like:
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

## Troubleshooting

**Port already in use?**
- Change the local port: `ssh -L 3001:localhost:3000 ...`
- Access at `http://localhost:3001`

**Connection refused?**
- Make sure the dev server is running on the remote server
- Check that it's listening on the right interface

**Can't access from phone?**
- Use Option 3 above
- Find your laptop's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- Make sure your laptop's firewall allows connections on port 3000

