import { layoutTree } from './treeLayout.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const notesArea = document.getElementById('notesArea');
const preview = document.getElementById('markdownPreview');
const writePane = document.getElementById('writePane');
const readPane = document.getElementById('readPane');
const maxHistory = 1000;

// Initialize tree with all required properties
let tree = { 
  label: "Root", 
  children: [], 
  x: 0, 
  y: 0, 
  note: "",
  depth: 0,
  subtreeWeight: 1 
};

let selectedNode = tree;
const undoStack = [];
const redoStack = [];
let loadedFileName = null; // To track the loaded file name

// Enhanced infinite canvas capabilities
let zoomLevel = 1;
let panOffset = { x: 0, y: 0 };
let animationFrameId = null;
let targetZoomLevel = 1;
let targetPanOffset = { x: 0, y: 0 };
const zoomSmoothness = 0.15; // Controls smoothness of zoom animation (0-1)
const panSmoothness = 0.15;  // Controls smoothness of pan animation (0-1)

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

    writePane.classList.toggle('open');
    readPane.classList.toggle('open');
}

// Prepare node for serialization by removing circular references
function prepareForSerialization(node) {
  // Create a deep copy without circular references
  function copyNodeWithoutCircular(node) {
    const copy = { ...node };
    delete copy.parent;

    if (copy.children && copy.children.length > 0) {
      copy.children = copy.children.map(copyNodeWithoutCircular);
    }
    
    return copy;
  }
  
  return copyNodeWithoutCircular(node);
}

// Restore parent references after deserialization
function restoreParentReferences(node, parent = null, depth = 0) {
  node.parent = parent;
  node.depth = depth;
  node.subtreeWeight = 1;
  node.children = node.children || [];
  
  for (let child of node.children) {
    restoreParentReferences(child, node, depth + 1);
    node.subtreeWeight += child.subtreeWeight;
  }
  
  return node;
}

function saveState() {
  // Save a clean copy without circular references
  const serializedTree = JSON.stringify(prepareForSerialization(tree));
  undoStack.push(serializedTree);
  if (undoStack.length > maxHistory) undoStack.shift();
  redoStack.length = 0;
}

function undo() {
  if (undoStack.length === 0) return;
  
  // Save current state in redo stack
  const currentState = JSON.stringify(prepareForSerialization(tree));
  redoStack.push(currentState);
  
  // Restore from undo stack
  const restoredTree = JSON.parse(undoStack.pop());
  tree = restoreParentReferences(restoredTree);
  
  // Reset selected node to root as a fallback
  selectedNode = tree;
  notesArea.value = selectedNode.note || "";
  updateMarkdownPreview();
  
  layoutTree(tree, canvas);
  draw();
}

function redo() {
  if (redoStack.length === 0) return;
  
  // Save current state in undo stack
  const currentState = JSON.stringify(prepareForSerialization(tree));
  undoStack.push(currentState);
  
  // Restore from redo stack
  const restoredTree = JSON.parse(redoStack.pop());
  tree = restoreParentReferences(restoredTree);
  
  // Reset selected node to root as a fallback
  selectedNode = tree;
  notesArea.value = selectedNode.note || "";
  updateMarkdownPreview();
  
  layoutTree(tree, canvas);
  draw();
}

// Transform canvas coordinates to account for zoom and pan
function transformCoordinates(x, y) {
  return {
    x: (x - panOffset.x) / zoomLevel,
    y: (y - panOffset.y) / zoomLevel
  };
}

// Center view on a specific node with animation
function centerOnNode(node, withAnimation = true) {
  if (!node) return;
  
  const canvasCenterX = canvas.width / 2;
  const canvasCenterY = canvas.height / 2;
  
  if (withAnimation) {
    // Set target values for smooth animation
    targetPanOffset.x = canvasCenterX - node.x * zoomLevel;
    targetPanOffset.y = canvasCenterY - node.y * zoomLevel;
    
    // Start animation if not already running
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(animateCanvas);
    }
  } else {
    // Immediate centering without animation
    panOffset.x = canvasCenterX - node.x * zoomLevel;
    panOffset.y = canvasCenterY - node.y * zoomLevel;
    targetPanOffset = {...panOffset};
    draw();
  }
}

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  // Apply inverse transform to get the actual coordinates in the zoomed/panned space
  const { x, y } = transformCoordinates(clickX, clickY);

  function findNode(node) {
    // Calculate distance with zoom factor
    const effectiveRadius = NODE_RADIUS || 20; // Fallback to 20 if not defined
    if (Math.hypot(node.x - x, node.y - y) < effectiveRadius) return node;
    
    if (node.children) {
      for (let child of node.children) {
        const found = findNode(child);
        if (found) return found;
      }
    }
    
    return null;
  }

  const clicked = findNode(tree);
  if (clicked) {
    selectedNode = clicked;
    notesArea.value = selectedNode.note || "";
    updateMarkdownPreview();
    
    // Center on selected node with animation
    centerOnNode(clicked);
    
    draw();
  }
});

// Smooth animation function for zoom and pan
function animateCanvas() {
  let stillAnimating = false;
  
  // Animate zoom
  if (Math.abs(zoomLevel - targetZoomLevel) > 0.001) {
    zoomLevel += (targetZoomLevel - zoomLevel) * zoomSmoothness;
    stillAnimating = true;
  }
  
  // Animate pan
  if (Math.abs(panOffset.x - targetPanOffset.x) > 0.5 || 
      Math.abs(panOffset.y - targetPanOffset.y) > 0.5) {
    panOffset.x += (targetPanOffset.x - panOffset.x) * panSmoothness;
    panOffset.y += (targetPanOffset.y - panOffset.y) * panSmoothness;
    stillAnimating = true;
  }
  
  draw();
  
  // Continue animation loop if needed
  if (stillAnimating) {
    animationFrameId = requestAnimationFrame(animateCanvas);
  } else {
    animationFrameId = null;
  }
}

// Double-click to focus & zoom to a node
canvas.addEventListener('dblclick', e => {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  // Apply inverse transform to get actual coordinates
  const { x, y } = transformCoordinates(clickX, clickY);
  
  // Find clicked node
  function findNode(node) {
    const effectiveRadius = NODE_RADIUS || 20;
    if (Math.hypot(node.x - x, node.y - y) < effectiveRadius) return node;
    
    if (node.children) {
      for (let child of node.children) {
        const found = findNode(child);
        if (found) return found;
      }
    }
    
    return null;
  }
  
  const clicked = findNode(tree);
  if (clicked) {
    selectedNode = clicked;
    notesArea.value = selectedNode.note || "";
    updateMarkdownPreview();
    
    // Set zoom target to focus on this node
    targetZoomLevel = Math.min(2.0, zoomLevel * 1.5);
    centerOnNode(clicked);
    
    // Start animation if not already running
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(animateCanvas);
    }
  }
});

// Handle zoom with mouse wheel
canvas.addEventListener('wheel', e => {
  e.preventDefault(); // Prevent page scrolling
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Get pre-zoom mouse position in logical coordinates
  const preZoomCoords = transformCoordinates(mouseX, mouseY);
  
  // Adjust zoom level based on wheel direction with smoother control
  const zoomDelta = -Math.sign(e.deltaY) * 0.1;
  targetZoomLevel = Math.max(0.1, Math.min(5, zoomLevel * (1 + zoomDelta)));
  
  // Calculate post-zoom coordinates to keep mouse point fixed during zoom
  const zoomRatio = targetZoomLevel / zoomLevel;
  
  // Update target pan offset to zoom toward/away from mouse position
  targetPanOffset.x = mouseX - preZoomCoords.x * targetZoomLevel;
  targetPanOffset.y = mouseY - preZoomCoords.y * targetZoomLevel;
  
  // Start animation if not already running
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(animateCanvas);
  }
}, { passive: false });

// Add mouse drag functionality for panning
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };

canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return; // Only respond to left mouse button
  
  const rect = canvas.getBoundingClientRect();
  lastMousePos = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  isDragging = true;
  canvas.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Calculate the distance moved
  const dx = mouseX - lastMousePos.x;
  const dy = mouseY - lastMousePos.y;
  
  // Update pan offset and target
  panOffset.x += dx;
  panOffset.y += dy;
  targetPanOffset = {...panOffset};
  
  // Update last mouse position
  lastMousePos = { x: mouseX, y: mouseY };
  
  draw();
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  canvas.style.cursor = 'default';
});

// Reset view to fit all nodes
function resetView() {
  // Find the bounds of all nodes
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  function traverseForBounds(node) {
    if (!node) return;
    
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
    
    if (node.children) {
      node.children.forEach(traverseForBounds);
    }
  }
  
  traverseForBounds(tree);
  
  // Add padding
  const padding = 50;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;
  
  // Calculate optimal zoom to fit all nodes
  const width = maxX - minX;
  const height = maxY - minY;
  const horizontalZoom = canvas.width / width;
  const verticalZoom = canvas.height / height;
  targetZoomLevel = Math.min(horizontalZoom, verticalZoom, 1); // Limit max zoom out
  
  // Calculate center position of all nodes
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  // Center the view on this position
  const canvasCenterX = canvas.width / 2;
  const canvasCenterY = canvas.height / 2;
  targetPanOffset.x = canvasCenterX - centerX * targetZoomLevel;
  targetPanOffset.y = canvasCenterY - centerY * targetZoomLevel;
  
  // Start animation
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(animateCanvas);
  }
}

function addNode() {
  const label = prompt("New node label:");
  if (!label) return;
  
  saveState();
  
  // Create new node with all required properties
  const newNode = {
    label,
    children: [],
    note: "",
    x: selectedNode.x,
    y: selectedNode.y,
    depth: selectedNode.depth + 1,
    subtreeWeight: 1,
    parent: selectedNode
  };
  
  // Ensure the children array exists
  if (!selectedNode.children) {
    selectedNode.children = [];
  }
  
  selectedNode.children.push(newNode);
  selectedNode.subtreeWeight += 1;
  
  // Select the new node
  selectedNode = newNode;
  notesArea.value = selectedNode.note;
  updateMarkdownPreview();
  
  // Update layout and draw
  layoutTree(tree, canvas);
  
  // Center on the new node
  centerOnNode(newNode);
}

// Draw grid background for infinite canvas
function drawGrid() {
  const gridSize = 50; // Size of grid cells
  const majorGridEvery = 5; // Draw a major grid line every X cells
  
  // Calculate visible grid area
  const visibleLeft = -panOffset.x / zoomLevel;
  const visibleTop = -panOffset.y / zoomLevel;
  const visibleRight = (canvas.width - panOffset.x) / zoomLevel;
  const visibleBottom = (canvas.height - panOffset.y) / zoomLevel;
  
  // Round to nearest grid lines
  const startX = Math.floor(visibleLeft / gridSize) * gridSize;
  const startY = Math.floor(visibleTop / gridSize) * gridSize;
  const endX = Math.ceil(visibleRight / gridSize) * gridSize;
  const endY = Math.ceil(visibleBottom / gridSize) * gridSize;
  
  ctx.save();
  ctx.translate(panOffset.x, panOffset.y);
  ctx.scale(zoomLevel, zoomLevel);
  
  // Draw vertical grid lines
  for (let x = startX; x <= endX; x += gridSize) {
    const isMajor = Math.round(x / gridSize) % majorGridEvery === 0;
    ctx.strokeStyle = isMajor ? 'rgba(150,150,150,0.2)' : 'rgba(200,200,200,0.1)';
    ctx.lineWidth = isMajor ? 0.5 : 0.2;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  
  // Draw horizontal grid lines
  for (let y = startY; y <= endY; y += gridSize) {
    const isMajor = Math.round(y / gridSize) % majorGridEvery === 0;
    ctx.strokeStyle = isMajor ? 'rgba(150,150,150,0.2)' : 'rgba(200,200,200,0.1)';
    ctx.lineWidth = isMajor ? 0.5 : 0.2;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
  
  ctx.restore();
}

// Constants for node rendering
const NODE_RADIUS = 20;

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid for infinite canvas
  drawGrid();
  
  // Save the current context state
  ctx.save();
  
  // Apply zoom and pan transformations
  ctx.translate(panOffset.x, panOffset.y);
  ctx.scale(zoomLevel, zoomLevel);
  
  function drawNode(node) {
    if (!node || typeof node.x === 'undefined' || typeof node.y === 'undefined') return;
    
    // Draw connections to children first (lines)
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        if (typeof child.x === 'undefined' || typeof child.y === 'undefined') return;
        
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(child.x, child.y);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2 / zoomLevel; // Adjust line width based on zoom
        ctx.stroke();
      });
      
      // Then recursively draw all children
      node.children.forEach(drawNode);
    }
    
    // Draw the node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = '#aaf';
    ctx.fill();
    ctx.strokeStyle = (node === selectedNode) ? 'red' : 'black';
    ctx.lineWidth = 2 / zoomLevel; // Adjust line width based on zoom
    ctx.stroke();
    
    // Scale font size inversely to zoom to maintain consistent text size
    const fontSize = 14 / zoomLevel;
    ctx.fillStyle = 'black';
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, node.x, node.y);
  }
  
  // Start drawing from the root node
  drawNode(tree);
  
  // Restore the context state
  ctx.restore();
  
  // Draw zoom level indicator
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Zoom: ${Math.round(zoomLevel * 100)}%`, 10, 10);
}

function download() {
  try {
    // Use the prepareForSerialization function to create a clean copy for JSON
    const serializedTree = prepareForSerialization(tree);
    
    // Create a properly formatted JSON string
    const jsonString = JSON.stringify(serializedTree, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'mindmap.json'; 
    link.href = URL.createObjectURL(blob);
    link.click();
    
    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
    
    alert("Mind map exported successfully.");
  } catch (err) {
    console.error("Failed to export the file:", err);
    alert("Failed to export the file: " + err.message);
  }
}

document.getElementById('fileInput').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      // Save current state for undo functionality
      saveState();
      
      // Parse the JSON data from the file
      const loadedTree = JSON.parse(e.target.result);
      
      // Reset any existing parent relationships to avoid problems
      tree = restoreParentReferences(loadedTree);
      
      // Store the filename for future save operations
      loadedFileName = file.name;
      
      // Update the selected node to the root of the loaded tree
      selectedNode = tree;
      notesArea.value = selectedNode.note || "";
      updateMarkdownPreview();
      
      // Reset zoom and pan when loading a new file
      resetView();
      
      // Calculate the layout and redraw
      layoutTree(tree, canvas);
      draw();
      
      console.log("Mind map loaded successfully");
    } catch (err) {
      console.error("Error loading mind map:", err);
      alert("Invalid JSON file. Please make sure the file is a valid mind map export.");
    }
  };
  
  reader.onerror = function() {
    alert("Error reading file. Please try again.");
  };
  
  reader.readAsText(file);
});

function save() {
  if (!loadedFileName) {
    // If there's no loaded file name, prompt the user to create one
    loadedFileName = prompt("Enter a filename to save as:", "mindmap.json");
    if (!loadedFileName) return; // User canceled
    
    // Add .json extension if not present
    if (!loadedFileName.toLowerCase().endsWith('.json')) {
      loadedFileName += '.json';
    }
  }

  try {
    // Use the same serialization method as the download function
    const serializedTree = prepareForSerialization(tree);
    const jsonString = JSON.stringify(serializedTree, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = loadedFileName;
    link.href = URL.createObjectURL(blob);
    link.click();
    
    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
    
    alert("Mind map saved successfully.");
  } catch (err) {
    console.error("Failed to save the file:", err);
    alert("Failed to save the file: " + err.message);
  }
}

// Initialize immediately when script loads
function initializeCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  
  // Ensure root node has initial position
  tree.x = canvas.width / 2;
  tree.y = canvas.height / 2;
  
  // Initial layout and draw
  layoutTree(tree, canvas);
  draw();
}

// Initialize on load and resize
window.addEventListener('resize', initializeCanvas);
window.addEventListener('load', initializeCanvas);

// Ensure immediate initialization even before full page load
initializeCanvas();

// Expose functions to window for HTML onclick handlers
window.addNode = addNode;
window.undo = undo;
window.redo = redo;
window.download = download;
window.toggleNotes = toggleNotes;
window.save = save;
window.resetView = resetView;

// Initialize immediately
resizeCanvas();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const writePane = document.getElementById('notesPane');
  const readPane = document.getElementById('markdownPane');

  writePane.classList.add('open');
  readPane.classList.add('open');

  resizeCanvas();
  draw();
});