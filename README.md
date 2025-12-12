# MAGiC
MAGiC Modeling UI and Software - Genetic Circuit Designer

This is the MAGiC (Modular and Adaptive Genetic Information Circuit) web application for designing and simulating genetic circuits.

## Files Included:
- app.py - Main Flask application
- main.py - Entry point for the application
- circuit_model.py - Circuit modeling and simulation engine
- constants.py - Component constants and parameters
- templates/ - HTML templates for the web interface
- static/ - CSS, JavaScript, and other static assets
- pyproject.toml - Project dependencies

## To Run:

### Option 1: Using Virtual Environment (Recommended)
1. Create and activate virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies: `pip install -r requirements.txt`
3. Run the application: `python main.py`
4. Open your browser to http://localhost:5001

### Option 2: Using UV (Fast Package Manager)
1. Install UV: `pip install uv`
2. Install dependencies: `uv pip install -r requirements.txt`
3. Run the application: `python main.py`
4. Open your browser to http://localhost:5001

### Option 3: Direct Installation
1. Install dependencies: `pip install -r requirements.txt`
2. Run the application: `python main.py`
3. Open your browser to http://localhost:5001

**Port Configuration:**
- Uses port 5001 by default to avoid conflicts with macOS AirPlay Receiver on port 5000
- Set PORT environment variable to use different port: `PORT=8000 python main.py`
- To deactivate virtual environment when done: `deactivate`

## Features:
- Drag-and-drop circuit design interface
- Advanced genetic circuit simulation
- Parameter tuning with dial mode
- EEPROM hardware integration
- LaTeX equation display
- Export/import functionality
