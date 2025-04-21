export function layoutTree(tree, canvas) {
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