# Genetic Circuit Designer - User Installation Guide

---

##  Complete Setup Guide (First Time)

Follow these steps carefully.

### Step 1: Install Python

Python is the programming language that runs this application.

#### For macOS:
1. Open your web browser (Safari, Chrome, etc.)
2. Go to: **https://www.python.org/downloads/**
3. Click the big yellow button that says **"Download Python 3.x.x"**
4. Once downloaded, **double-click** the downloaded file (it's in your Downloads folder)
5. Follow the installation wizard - just keep clicking **"Continue"** and **"Install"**
6. Enter your Mac password when asked

#### For Windows:
1. Open your web browser (Edge, Chrome, etc.)
2. Go to: **https://www.python.org/downloads/**
3. Click the big yellow button that says **"Download Python 3.x.x"**
4. Once downloaded, **double-click** the downloaded file
5. ** IMPORTANT:** Check the box that says **"Add Python to PATH"** at the bottom
6. Click **"Install Now"**
7. Wait for it to finish, then click **"Close"**

#### For Linux:
Open Terminal and type:
```bash
sudo apt update
sudo apt install python3 python3-pip
```

---

### Step 2: Download the Project

1. **If you have the project folder already:** 
   - Make sure it's in an easy-to-find location like your Desktop or Documents folder
   - The folder should be named something like "Final Version" or "Genetic Circuit Designer"

2. **If you're downloading from GitHub:**
   - Go to the project's GitHub page
   - Click the green **"Code"** button
   - Click **"Download ZIP"**
   - Once downloaded, **double-click** the ZIP file to extract it
   - Move the extracted folder to your Desktop

---

### Step 3: Open Terminal/Command Prompt

This is where you'll type commands to run the application.

#### For macOS:
1. Press **Command (⌘) + Space** on your keyboard
2. Type **"Terminal"**
3. Press **Enter**
4. A window with black or white background will open - this is Terminal

#### For Windows:
1. Press **Windows Key + R** on your keyboard
2. Type **"cmd"** in the box that appears
3. Press **Enter**
4. A black window will open - this is Command Prompt

#### For Linux:
1. Press **Ctrl + Alt + T**
2. Terminal will open

---

### Step 4: Navigate to the Project Folder

You need to tell your computer where the project is located.

#### For macOS/Linux:
In Terminal, type this command (replace with your actual folder location):
```bash
cd ~/Desktop/Final\ Version
```

**Tips:**
- If your folder is in Documents instead: `cd ~/Documents/Final\ Version`
- If you're not sure of the exact name, type `cd ~/Desktop/` then press **Tab** - it will show you folders

#### For Windows:
In Command Prompt, type this command (replace with your actual folder location):
```cmd
cd C:\Users\YourUsername\Desktop\Final Version
```

**Tips:**
- Replace `YourUsername` with your actual Windows username
- If folder is in Documents: `cd C:\Users\YourUsername\Documents\Final Version`

**How to verify you're in the right place:**
- Type `dir` (Windows) or `ls` (Mac/Linux) and press Enter
- You should see files like `app.py`, `main.py`, `requirements.txt`

---

### Step 5: Create a Virtual Environment (Recommended)

A virtual environment keeps this project's software separate from other Python projects on your computer. This prevents conflicts and keeps things organized.

#### For macOS/Linux:

**Create the virtual environment** (only do this once):
```bash
python3 -m venv venv
```

**What this does:** Creates a folder called `venv` in your project folder that will store all the software packages.

#### For Windows:

**Create the virtual environment** (only do this once):
```cmd
python -m venv venv
```

**Wait for it to finish** - it takes about 30 seconds and you'll see no output. When it's done, you can type again.

---

### Step 6: Activate the Virtual Environment

**You need to do this EVERY TIME** you want to run the application.

#### For macOS/Linux:
```bash
source venv/bin/activate
```

#### For Windows (Command Prompt):
```cmd
venv\Scripts\activate
```

#### For Windows (PowerShell):
```powershell
venv\Scripts\Activate.ps1
```

**How to know it worked:**
- Your command line will now show `(venv)` at the beginning
- Example: `(venv) YourComputer:Final Version username$`
- This means the virtual environment is active!

**If you see an error on Windows PowerShell:**
- You might need to allow scripts to run
- Type this command once: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- Then try activating again

---

### Step 7: Install Required Software Packages

These are the tools the application needs to work.

** Make sure your virtual environment is activated** (you should see `(venv)` in your terminal)

**Type this command** (same for all operating systems):
```bash
pip install -r requirements.txt
```

Then press **Enter**.

**What will happen:**
- You'll see text scrolling on the screen - this is normal!
- It might take 2-5 minutes
- Wait until you see a message like "Successfully installed..." and you can type again

**If you see an error:**
- Try typing: `pip3 install -r requirements.txt` instead
- Or try: `python -m pip install -r requirements.txt`

---

### Step 8: Run the Application

Now you're ready to start the application!

** Make sure your virtual environment is activated** (you should see `(venv)` in your terminal)

**Type this command:**
```bash
python main.py
```

Then press **Enter**.

**What you should see:**
```
 * Running on http://0.0.0.0:8000
 * Running on http://127.0.0.1:8000
Press CTRL+C to quit
```

**This means it's working!** 🎉

---

### Step 9: Open the Application in Your Browser

1. Open your web browser (Chrome, Safari, Firefox, Edge - any browser works)
2. In the address bar at the top, type: **`localhost:8000`**
3. Press **Enter**
4. You should see the Genetic Circuit Designer welcome page!

##  Running the Application Again (After First Setup)

Once you've completed the setup above, running the application next time is much easier!

### Quick Start Instructions:

1. **Open Terminal/Command Prompt** (see Step 3 in first-time setup)

2. **Navigate to project folder:**
   ```bash
   # macOS/Linux:
   cd ~/Desktop/Final\ Version
   
   # Windows:
   cd C:\Users\YourUsername\Desktop\Final Version
   ```

3. **Activate the virtual environment:**
   ```bash
   # macOS/Linux:
   source venv/bin/activate
   
   # Windows (Command Prompt):
   venv\Scripts\activate
   
   # Windows (PowerShell):
   venv\Scripts\Activate.ps1
   ```
   
   **Check:** You should see `(venv)` appear at the start of your command line
##  Stopping the Application

When you're done using the application:

1. Go to the Terminal/Command Prompt window (where you typed `python main.py`)
2. Press **Ctrl + C** on your keyboard (works on Mac, Windows, and Linux)
3. You'll see it says something like "Keyboard interrupt received"
4. The application has stopped

### Deactivating the Virtual Environment

After stopping the application, you should deactivate the virtual environment:

**Type this command:**
```bash
deactivate
```

**What happens:**
- The `(venv)` prefix will disappear from your command line
- You're now back to your normal system environment
- You can safely close the Terminal/Command Prompt window now

**Why deactivate?**
- It's good practice to keep the virtual environment "closed" when not in use
- Prevents accidentally installing packages in the wrong place
- Keeps your system clean

**Important:** You need to **activate** the virtual environment again next time you run the application!

---hat's it!** You don't need to install anything again.

---

##  Stopping the Application

When you're done using the application:

1. Go to the Terminal/Command Prompt window (where you typed `python main.py`)
2. Press **Ctrl + C** on your keyboard (works on Mac, Windows, and Linux)
3. You'll see it says something like "Keyboard interrupt received"
4. The application has stopped
5. You can now close the Terminal/Command Prompt window

---

##  Using the Application

### Software Mode (Dial Interface)
1. Click **"Dial Mode"** on the home page
2. Drag components from the left sidebar onto the canvas
3. Connect components by dragging from one to another
4. Click **"Simulate"** to see results
5. Adjust parameters using the dial controls

### Hardware Mode (EEPROM Interface)
1. Click **"EEPROM Mode"** on the home page
2. Connect your EEPROM hardware board (if you have one)
3. Place components in the 128 channels (A0-H15)
4. Use multiplexer controls to navigate channels
5. Click **"Run Simulation"** to see results

---

##  Troubleshooting Common Issues

### "Command not found" or "Python is not recognized"

**Problem:** Python is not installed correctly.

**Solution:**
- Go back to Step 1 and reinstall Python
- **Windows users:** Make sure you checked "Add Python to PATH" during installation
- Restart your Terminal/Command Prompt after installing

---

### "No such file or directory" or "cannot find the path"

**Problem:** You're not in the right folder.

**Solution:**
1. Type `pwd` (Mac/Linux) or `cd` (Windows) to see where you are
2. Make sure you're in the folder containing `main.py`
3. Use the `cd` command to navigate to the correct location (see Step 4)

---

### "Could not find a version that satisfies the requirement"

**Problem:** Internet connection issue or pip needs updating.

**Solution:**
1. Check your internet connection
2. Try updating pip first:
   ```bash
   pip install --upgrade pip
   ```
3. Then try installing requirements again:
   ```bash
   pip install -r requirements.txt
   ```

---

### Browser shows "This site can't be reached" or "Unable to connect"

**Problem:** The application isn't running.

**Solution:**
1. Check the Terminal/Command Prompt window
2. Make sure you see "Running on http://127.0.0.1:8000"
3. If not, run `python main.py` again
4. Wait 5-10 seconds for it to start
5. Try refreshing your browser

---

### "Address already in use" error

**Problem:** Port 8000 is being used by another application.

**Solution:**
1. Close any other instances of the application
2. Or use a different port:
   ```bash
   # macOS/Linux:
   PORT=8001 python main.py
   
   # Windows (in Command Prompt):
   set PORT=8001
   python main.py
   ```
3. Then open browser to `localhost:8001` instead

---

### Changes I make don't appear when I refresh

**Problem:** Browser is caching old version.

**Solution:**
- Press **Ctrl + Shift + R** (Windows/Linux) or **Cmd + Shift + R** (Mac) to hard refresh
- Or clear your browser cache in settings

---

## 💡 Tips for Success

### Save Your Work!
- Use the **"Export Project"** button frequently to save your circuits
- Exported files are ZIP archives you can import later
- Keep backups of important designs

### Keep Terminal/Command Prompt Open
- Don't close the Terminal/Command Prompt window while using the application
- You can minimize it, but don't close it
- The application needs it to keep running

### Browser Compatibility
- Works best in **Chrome** or **Firefox**
- Safari and Edge also work
- If you see visual issues, try a different browser

### System Performance
- Close other applications if the simulation is slow
- Large circuits (many components) take longer to simulate
- Be patient - complex simulations can take 10-30 seconds

---

## Learning Resources

### Understanding Genetic Circuits
The application designs genetic circuits, which are like electronic circuits but made of DNA!

- **Promoter:** Starts making RNA (like a power switch)
- **RBS:** Helps make protein from RNA (like a voltage regulator)
- **CDS:** The gene that makes a specific protein (like the actual circuit component)
- **Terminator:** Stops making RNA (like an endpoint)

### Video Tutorials
(If available, add links to video tutorials here)

### Support
- Check the **About** page in the application for more information
- Read `DEVELOPER_README.md` if you want to modify the code
- Contact your lab administrator for technical support

---

## Safety & Privacy

- This application runs **entirely on your computer**
```
┌──────────────────────────────────────────────────────────┐
│         GENETIC CIRCUIT DESIGNER QUICK START              │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  1. Open Terminal/Command Prompt                         │
│                                                           │
│  2. Navigate to folder:                                  │
│     cd ~/Desktop/Final\ Version       (Mac/Linux)        │
│     cd C:\Users\...\Final Version     (Windows)          │
│                                                           │
│  3. Activate virtual environment:                        │
│     source venv/bin/activate          (Mac/Linux)        │
│     venv\Scripts\activate             (Windows)          │
│     → You should see (venv) appear                       │
│                                                           │
│  4. Start application:                                   │
│     python main.py                                       │
│                                                           │
│  5. Open browser:                                        │
│     localhost:8000                                       │
│                                                           │
│  6. When done:                                           │
│     - Press Ctrl + C to stop app                         │
│     - Type: deactivate                                   │
│     - Close Terminal                                     │
│                                                           │
└──────────────────────────────────────────────────────────┘
```you're stuck:

1. **Read the error message carefully** - it often tells you what's wrong
2. **Try the Troubleshooting section** above
3. **Restart everything** - close Terminal and browser, then start fresh
4. **Ask for help** - contact your lab administrator or tech support
5. **Take a screenshot** of any error messages to show someone who can help

---

## Quick Reference Card

Print or save this for easy reference:

```
┌─────────────────────────────────────────────────────┐
│         GENETIC CIRCUIT DESIGNER QUICK START         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Open Terminal/Command Prompt                    │
│                                                      │
│  2. Navigate to folder:                             │
│     cd ~/Desktop/Final\ Version    (Mac/Linux)      │
│     cd C:\Users\...\Final Version  (Windows)        │
│                                                      │
│  3. Start application:                              │
│     python main.py                                  │
│                                                      │
│  4. Open browser:                                   │
│     localhost:8000                                  │
│                                                      │
│  5. To stop: Press Ctrl + C                         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

**Version:** 17.1  
**Last Updated:** December 9, 2025  
**For Technical Details:** See `DEVELOPER_README.md`
