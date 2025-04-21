import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { layoutTree } from '../../treeLayout.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const notesArea = document.getElementById('notesArea');
const preview = document.getElementById('markdownPreview');
const writePane = document.getElementById('writePane');
const readPane = document.getElementById('readPane');
const maxHistory = 1000;

let tree = { label: "Root", children: [], x: 0, y: 0, note: "" };
let selectedNode = tree;
const undoStack = [];
const redoStack = [];
let loadedFileName = null; // To track the loaded file name

function resizeCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  layoutTree(tree, canvas);
  draw();
}

window.addEventListener('resize', resizeCanvas);

notesArea.addEventListener('input', () => {
  if (selectedNode) {
    selectedNode.note = notesArea.value;
    updateMarkdownPreview();
  }
});

function updateMarkdownPreview() {
  preview.innerHTML = marked.parse(notesArea.value || '');
}

function toggleNotes() {
    const writePane = document.getElementById('notesPane');
    const readPane = document.getElementById('markdownPane');

    writePane.classList.toggle('open'); // Toggle the open class for the write pane
    readPane.classList.toggle('open'); // Toggle the open class for the read pane
}

function saveState() {
  undoStack.push(JSON.stringify(tree));
  if (undoStack.length > maxHistory) undoStack.shift();
  redoStack.length = 0;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(tree));
  tree = JSON.parse(undoStack.pop());
  selectedNode = tree;
  notesArea.value = selectedNode.note || "";
  updateMarkdownPreview();
  layoutTree(tree, canvas);
  draw();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(tree));
  tree = JSON.parse(redoStack.pop());
  selectedNode = tree;
  notesArea.value = selectedNode.note || "";
  updateMarkdownPreview();
  layoutTree(tree, canvas);
  draw();
}

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  function findNode(node) {
    if (Math.hypot(node.x - x, node.y - y) < 20) return node;
    for (let child of node.children) {
      const found = findNode(child);
      if (found) return found;
    }
    return null;
  }

  const clicked = findNode(tree);
  if (clicked) {
    selectedNode = clicked;
    notesArea.value = selectedNode.note || "";
    updateMarkdownPreview();
    draw();
  }
});

function addNode() {
  const label = prompt("New node label:");
  if (!label) return;
  saveState();
  selectedNode.children.push({ label, children: [], note: "" });
  layoutTree(tree, canvas);
  draw();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  function drawNode(node) {
    node.children.forEach(child => {
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(child.x, child.y);
      ctx.stroke();
      drawNode(child);
    });

    ctx.beginPath();
    ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#aaf';
    ctx.fill();
    ctx.strokeStyle = (node === selectedNode) ? 'red' : 'black';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.fillText(node.label, node.x - 10, node.y + 5);
  }

  drawNode(tree);
}

async function download() {
  try {
    const data = JSON.stringify(tree, null, 2);
    const fileName = 'mindmap.json';

    // Save to Documents directory first
    await Filesystem.writeFile({
      path: fileName,
      data: data,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });

    // Get the file URI
    const fileResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Documents
    });

    // Show the share sheet
    await Share.share({
      title: 'Mind Map Export',
      url: fileResult.uri,
      dialogTitle: 'Save Mind Map'
    });

  } catch (err) {
    console.error('Error saving file:', err);
    alert("Error saving file: " + err.message);
  }
}

document.getElementById('fileInput').addEventListener('change', async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        saveState();
        tree = JSON.parse(e.target.result);
        selectedNode = tree;
        notesArea.value = selectedNode.note || "";
        updateMarkdownPreview();
        layoutTree(tree, canvas);
        draw();
        loadedFileName = file.name;
      } catch (err) {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  } catch (err) {
    console.error('Error reading file:', err);
    alert("Error reading file: " + err.message);
  }
});

async function save() {
  try {
    const data = JSON.stringify(tree, null, 2);
    const fileName = loadedFileName || 'mindmap.json';

    // First save to app documents directory
    await Filesystem.writeFile({
      path: fileName,
      data: data,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });

    // For iOS, we'll use the Share API to let users save to Files app
    const fileResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Documents
    });

    await Share.share({
      title: 'Save Mind Map',
      url: fileResult.uri,
      dialogTitle: 'Save Mind Map'
    });

  } catch (err) {
    console.error('Error saving file:', err);
    alert("Error saving file: " + err.message);
  }
}

// Add a function to list saved files
async function listSavedFiles() {
  try {
    const result = await Filesystem.readdir({
      path: '',
      directory: Directory.Documents
    });
    
    return result.files;
  } catch (err) {
    console.error('Error listing files:', err);
    return [];
  }
}

// Add a function to load a file
async function loadFile(filename) {
  try {
    const contents = await Filesystem.readFile({
      path: filename,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });
    
    const data = JSON.parse(contents.data);
    saveState();
    tree = data;
    selectedNode = tree;
    notesArea.value = selectedNode.note || "";
    updateMarkdownPreview();
    layoutTree(tree, canvas);
    draw();
    loadedFileName = filename;
  } catch (err) {
    console.error('Error loading file:', err);
    alert("Error loading file: " + err.message);
  }
}

// Add global function to create new nodes
window.addNode = function() {
  const label = prompt("New node label:");
  if (!label) return;
  saveState();
  selectedNode.children.push({ label, children: [], note: "" });
  layoutTree(tree, canvas);
  draw();
}

// Add global undo function
window.undo = function() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(tree));
  tree = JSON.parse(undoStack.pop());
  selectedNode = tree;
  notesArea.value = selectedNode.note || "";
  updateMarkdownPreview();
  layoutTree(tree, canvas);
  draw();
}

// Add global redo function
window.redo = function() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(tree));
  tree = JSON.parse(redoStack.pop());
  selectedNode = tree;
  notesArea.value = selectedNode.note || "";
  updateMarkdownPreview();
  layoutTree(tree, canvas);
  draw();
}

// Add global download function
window.download = async function() {
  try {
    const data = JSON.stringify(tree, null, 2);
    const fileName = 'mindmap.json';

    // Save to Documents directory first
    await Filesystem.writeFile({
      path: fileName,
      data: data,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });

    // Get the file URI
    const fileResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Documents
    });

    // Show the share sheet
    await Share.share({
      title: 'Mind Map Export',
      url: fileResult.uri,
      dialogTitle: 'Save Mind Map'
    });

  } catch (err) {
    console.error('Error saving file:', err);
    alert("Error saving file: " + err.message);
  }
}

// Add global save function
window.save = async function() {
  try {
    const data = JSON.stringify(tree, null, 2);
    const fileName = loadedFileName || 'mindmap.json';

    // First save to app documents directory
    await Filesystem.writeFile({
      path: fileName,
      data: data,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });

    // For iOS, we'll use the Share API to let users save to Files app
    const fileResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Documents
    });

    await Share.share({
      title: 'Save Mind Map',
      url: fileResult.uri,
      dialogTitle: 'Save Mind Map'
    });

  } catch (err) {
    console.error('Error saving file:', err);
    alert("Error saving file: " + err.message);
  }
}

// Add global toggle notes function
window.toggleNotes = function() {
    const writePane = document.getElementById('notesPane');
    const readPane = document.getElementById('markdownPane');

    writePane.classList.toggle('open');
    readPane.classList.toggle('open');
}

// Add global showSavedFiles function
window.showSavedFiles = async function() {
  try {
    const result = await Filesystem.readdir({
      path: '',
      directory: Directory.Documents
    });

    if (!result.files || result.files.length === 0) {
      alert('No saved files found');
      return;
    }

    const files = result.files.filter(file => file.endsWith('.json'));
    
    if (files.length === 0) {
      alert('No mind map files found');
      return;
    }

    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <div style="padding: 20px">
        <h3>Saved Mind Maps</h3>
        <div style="max-height: 300px; overflow-y: auto">
          ${files.map(file => `
            <button onclick="window.loadFile('${file}'); this.closest('dialog').close()" 
                    style="display: block; width: 100%; margin: 5px 0; padding: 10px">
              ${file}
            </button>
          `).join('')}
        </div>
        <button onclick="this.closest('dialog').close()" 
                style="margin-top: 15px; padding: 10px">
          Close
        </button>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();
  } catch (err) {
    console.error('Error listing files:', err);
    alert("Error listing files: " + err.message);
  }
}

// Initialize the view
window.addEventListener('DOMContentLoaded', () => {
  const writePane = document.getElementById('notesPane');
  const readPane = document.getElementById('markdownPane');

  writePane.classList.add('open');
  readPane.classList.add('open');

  resizeCanvas();
  
  // Center the initial root node
  tree.x = canvas.width / 2;
  tree.y = canvas.height / 2;
  
  // Draw the initial state
  layoutTree(tree, canvas);
  draw();
});