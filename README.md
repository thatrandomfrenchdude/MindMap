# MindMap

> **Status:** In development

This project is a simple fractal mind map tool built with HTML, CSS, and JavaScript, with iOS support via Capacitor.

## Features
* Interactive canvas for creating and organizing nodes
* Markdown-supported notes pane
* Undo/redo functionality
* JSON export and import
* Toggleable "Read" and "Write" views

## Web Setup
1. Clone or download this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start the development server

## iOS Setup
1. Ensure you have Xcode installed
2. Install iOS development dependencies and build:
   ```bash
   npm install
   npx cap sync
   ```
3. Open the iOS project in Xcode:
   ```bash
   npx cap open ios
   ```
4. In Xcode, select your target device/simulator and click Run

## Development
- For web development, use `npm run dev`
- For iOS development:
  1. Make changes to web code
  2. Run `npm run build`
  3. Run `npx cap copy` to update iOS assets
  4. Build and run in Xcode

## Usage
* **Add a node:** Click **Add Node** in the toolbar.
* **Select a node:** Click a node in the canvas.
* **Write notes:** Type into the text area on the right pane.
* **View notes:** The left pane renders the written markdown.
* **Undo/redo changes:** Use the **Back** or **Forward** buttons.
* **Export/Save:** Click **Export JSON** to download, or **Save** if you loaded a file already.
* **Load a file:** Choose a JSON file with the **file** input.
