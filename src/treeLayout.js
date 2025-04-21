export function layoutTree(tree, canvas) {
  const NODE_RADIUS = 20; // Radius of each node
  const BASE_CONNECTION_LENGTH = NODE_RADIUS * 4; // Base connection length
  
  // First, analyze tree to determine its depth and maximum nodes per layer
  function analyzeTree(node, currentDepth = 0, depthInfo = {}) {
    // Track maximum depth
    if (!depthInfo.maxDepth || currentDepth > depthInfo.maxDepth) {
      depthInfo.maxDepth = currentDepth;
    }
    
    // Count nodes at this depth
    depthInfo[currentDepth] = (depthInfo[currentDepth] || 0) + 1;
    
    // Recursively analyze children
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        analyzeTree(child, currentDepth + 1, depthInfo);
      });
    }
    
    return depthInfo;
  }
  
  // Calculate positions recursively using a concentric circles layout
  function calculatePositions(node, depth = 0, angleStart = 0, angleEnd = 2 * Math.PI, treeInfo = {}) {
    const children = node.children || [];
    if (children.length === 0) return;

    const angleStep = (angleEnd - angleStart) / children.length;
    
    // Calculate radius for this layer to ensure no overlapping
    // Each layer is a perfect circle around the parent
    const maxDepth = treeInfo.maxDepth || 1;
    const nodesAtThisLevel = treeInfo[depth + 1] || 1;
    
    // Calculate minimum radius needed to prevent node overlap within this layer
    // Each node needs enough arc length based on the number of nodes in this circle
    const minRadiusForNoOverlap = Math.max(
      BASE_CONNECTION_LENGTH,
      (NODE_RADIUS * 2.5 * nodesAtThisLevel) / (2 * Math.PI)
    );
    
    // Calculate radius based on depth - concentric circles with appropriate spacing
    const layerRadius = Math.max(
      minRadiusForNoOverlap,
      BASE_CONNECTION_LENGTH * (1.5 + depth * 1.2)
    );

    // Position children in circle around parent
    children.forEach((child, i) => {
      const angle = angleStart + i * angleStep + angleStep / 2;
      child.x = node.x + Math.cos(angle) * layerRadius;
      child.y = node.y + Math.sin(angle) * layerRadius;
      
      // Calculate angle range for child's children
      const childAngleRange = Math.min(angleStep * 0.95, Math.PI / 4);
      calculatePositions(
        child,
        depth + 1,
        angle - childAngleRange / 2,
        angle + childAngleRange / 2,
        treeInfo
      );
    });
  }

  function ensureNodesInBounds(node) {
    // For infinite canvas, we don't need to enforce boundary constraints
    // But we'll keep this function for compatibility, doing nothing
  }

  // Center the root node
  tree.x = canvas.width / 2;
  tree.y = canvas.height / 2;

  // First analyze the tree to get depth and width information
  const treeInfo = analyzeTree(tree);
  
  // Then calculate positions with this information
  calculatePositions(tree, 0, 0, 2 * Math.PI, treeInfo);
}