# Your Database Connection Information

## SSH Server Details

**Server IP Address:** `10.20.75.182`  
**Your Username:** `nwalchenbach`  
**SSH Port:** `22` (default)  
**Prisma Studio Port:** `5555`

---

## Step-by-Step: Access Prisma Studio from Git Bash

### Step 1: Open Git Bash on your Windows computer

### Step 2: Run this EXACT command:

```bash
ssh -L 0.0.0.0:5555:localhost:5555 nwalchenbach@10.20.75.182
```

**What this does:**
- Connects to your SSH server at `10.20.75.182`
- Forwards port 5555 (Prisma Studio) from the server to your local computer
- The `0.0.0.0` makes it accessible from your browser

### Step 3: Enter your SSH password when prompted

(You'll need to type your SSH password for user `nwalchenbach`)

### Step 4: Keep Git Bash open!

**IMPORTANT:** Leave this Git Bash window open. The port forwarding only works while the SSH connection is active.

### Step 5: Open your web browser

On your Windows computer, open Chrome, Firefox, or Edge and go to:

```
http://localhost:5555
```

### Step 6: View your database!

You should now see Prisma Studio with all your tables:
- **User** - 3 users
- **Project** - 25 projects
- **Report** - 47 reports
- **SubcontractorCompany** - 102 subcontractors
- **ReportSubcontractorActivity** - 392 activities
- And more...

---

## Quick Reference

**SSH Command:**
```bash
ssh -L 0.0.0.0:5555:localhost:5555 nwalchenbach@10.20.75.182
```

**Browser URL:**
```
http://localhost:5555
```

**If port 5555 is busy, use 5556:**
```bash
ssh -L 0.0.0.0:5556:localhost:5555 nwalchenbach@10.20.75.182
```
Then use: `http://localhost:5556`

---

## Troubleshooting

**"Connection refused" or can't connect:**
- Make sure Prisma Studio is running on the server (it should be)
- Verify you're using the correct IP: `10.20.75.182`
- Check that your SSH connection is still active in Git Bash

**"Permission denied" or password issues:**
- Make sure you're using the correct username: `nwalchenbach`
- Verify your SSH password is correct
- If you use SSH keys, make sure they're set up correctly

**Port already in use:**
- Close any other applications using port 5555
- Or use port 5556 instead (see above)

