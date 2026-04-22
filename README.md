# MAGiC
MAGiC Modeling UI and Software

This is the MAGiC (MAthematical Gene Circuit) web application for designing and simulating genetic circuits.

## Files Included:
- app.py - Main Flask application
- main.py - Entry point for the application
- circuit_model.py - Circuit modeling and simulation logic
- constants.py - Component constants and parameters
- templates/ - HTML templates for the web interface
- static/ - CSS, JavaScript, and other static assets
- pyproject.toml - Project dependencies


Prerequisite: Python 3.10 or newer must be installed and available on your PATH. Verify with python --version. If you don't have it, install from python.org or via Anaconda — either works.


## To Run:

1. Open the project folder in VS Code and open a terminal (`` Ctrl+` ``)..

2. Create and activate a virtual environment:
   
   ```bash
   # macOS / Linux:
   python -m venv venv
   source venv/bin/activate
   ```

   # Windows PowerShell:
   
   ```powershell
   # Windows PowerShell:
   python -m venv venv
   venv\Scripts\Activate.ps1
   ```

3. Install dependencies
   
   ```
   pip install -r requirements.txt
   ```

4. Run the application
   
   ```
   python main.py
   ```

5. Open your browser to http://127.0.0.1:8000

   To stop the server: Ctrl+C. To leave the virtual environment: deactivate.

## Features:
- Drag-and-drop circuit design interface
- Advanced genetic circuit simulation
- Parameter tuning with dial mode
- EEPROM hardware integration
- LaTeX equation display
- Export/import functionality
