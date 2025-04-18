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
  layoutTree();
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
  layoutTree();
  draw();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(tree));
  tree = JSON.parse(redoStack.pop());
  selectedNode = tree;
  notesArea.value = selectedNode.note || "";
  updateMarkdownPreview();
  layoutTree();
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
  layoutTree();
  draw();
}

function layoutTree() {
  const baseRadius = 80;
  const levelSpacing = 50;

  function calculatePositions(node, depth = 0, angleStart = 0, angleEnd = 2 * Math.PI) {
    const children = node.children;
    if (!children.length) return;

    const angleStep = (angleEnd - angleStart) / children.length;
    const radius = baseRadius + depth * levelSpacing;

    children.forEach((child, i) => {
      const angle = angleStart + i * angleStep + angleStep / 2;
      child.x = node.x + Math.cos(angle) * radius;
      child.y = node.y + Math.sin(angle) * radius;
      calculatePositions(child, depth + 1, angleStart + i * angleStep, angleStart + (i + 1) * angleStep);
    });
  }

  function adjustPositions(node, allNodes) {
    const minDistance = 40; // Minimum distance between nodes
    allNodes.forEach(otherNode => {
      if (node === otherNode) return;
      const dx = node.x - otherNode.x;
      const dy = node.y - otherNode.y;
      const distance = Math.hypot(dx, dy);
      if (distance < minDistance) {
        const angle = Math.atan2(dy, dx);
        const overlap = minDistance - distance;
        node.x += Math.cos(angle) * overlap / 2;
        node.y += Math.sin(angle) * overlap / 2;
        otherNode.x -= Math.cos(angle) * overlap / 2;
        otherNode.y -= Math.sin(angle) * overlap / 2;
      }
    });

    node.children.forEach(child => adjustPositions(child, allNodes));
  }

  function collectAllNodes(node, allNodes = []) {
    allNodes.push(node);
    node.children.forEach(child => collectAllNodes(child, allNodes));
    return allNodes;
  }

  tree.x = canvas.width / 2;
  tree.y = canvas.height / 2;
  calculatePositions(tree);

  const allNodes = collectAllNodes(tree);
  allNodes.forEach(node => adjustPositions(node, allNodes));
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

function download() {
  try {
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'mindmap.json'; // Default export file name
    link.href = URL.createObjectURL(blob);
    link.click();
    alert("File exported successfully.");
  } catch (err) {
    alert("Failed to export the file.");
  }
}

document.getElementById('fileInput').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      saveState();
      tree = JSON.parse(e.target.result);
      selectedNode = tree;
      notesArea.value = selectedNode.note || "";
      updateMarkdownPreview();
      layoutTree();
      draw();
      loadedFileName = file.name; // Store the file name for saving later
    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
});

function save() {
  if (!loadedFileName) {
    alert("No file loaded to save.");
    return;
  }

  try {
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = loadedFileName; // Use the loaded file name for saving
    link.href = URL.createObjectURL(blob);
    link.click();
    alert("File saved successfully.");
  } catch (err) {
    alert("Failed to save the file.");
  }
}

// Open notes pane by default
window.addEventListener('DOMContentLoaded', () => {
  const writePane = document.getElementById('notesPane');
  const readPane = document.getElementById('markdownPane');

  writePane.classList.add('open'); // Open the write pane by default
  readPane.classList.add('open'); // Open the read pane by default

  resizeCanvas();
});