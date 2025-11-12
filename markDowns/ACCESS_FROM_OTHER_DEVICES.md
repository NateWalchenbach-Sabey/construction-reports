# Accessing the App from Other Devices

## Quick Setup

The app is now configured to be accessible from other devices on your WiFi network.

## Your Local IP Address

Your local IP address is: **10.20.75.182**

## How to Access

1. **Make sure the dev server is running:**
   ```bash
   npm run dev
   ```

2. **On another device (laptop, phone, tablet) connected to the same WiFi:**
   - Open a web browser
   - Go to: `http://10.20.75.182:3000`

3. **You should see the Sabey Construction app!**

## Important Notes

- ✅ Both devices must be on the same WiFi network
- ✅ The dev server must be running on your computer
- ✅ If you change networks, your IP address may change
- ⚠️ If it doesn't work, check your firewall settings

## Finding Your IP Address (if it changes)

If your IP address changes, you can find it again:

**Linux:**
```bash
hostname -I | awk '{print $1}'
```

**macOS:**
```bash
ipconfig getifaddr en0
```

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your WiFi adapter

## Troubleshooting

**Can't connect from another device?**
1. Check that both devices are on the same WiFi network
2. Make sure the dev server is running with `-H 0.0.0.0` flag
3. Check your firewall - you may need to allow port 3000
4. Try disabling your firewall temporarily to test

**Firewall setup (Ubuntu/Debian):**
```bash
sudo ufw allow 3000/tcp
```



