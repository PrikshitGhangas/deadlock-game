/**
 * bPlusTree.js — Interactive B+ Tree Engine
 *
 * Implements a complete B+ Tree data structure with:
 * - Configurable Order M (max keys = M - 1)
 * - Automatic node splitting (leaf splitting with copy-up & sibling pointers,
 *   internal splitting with push-up)
 * - Animated search path tracing with step-by-step comparisons
 * - Range search along leaf node linked list
 * - Visual tree export for React SVG / DOM tree rendering
 */

let nextNodeId = 1;

export class BPlusTreeNode {
  constructor(isLeaf = false) {
    this.id = `node_${nextNodeId++}`;
    this.isLeaf = isLeaf;
    this.keys = [];
    /** @type {BPlusTreeNode[]} */
    this.children = []; // For internal nodes: child pointers
    /** @type {BPlusTreeNode|null} */
    this.next = null;   // For leaf nodes: pointer to next leaf in sequence
    /** @type {BPlusTreeNode|null} */
    this.prev = null;
  }
}

export class BPlusTree {
  /**
   * @param {number} order - maximum number of children per internal node (order M >= 3)
   */
  constructor(order = 3) {
    nextNodeId = 1;
    this.order = Math.max(3, Number(order) || 3);
    this.maxKeys = this.order - 1;
    this.root = new BPlusTreeNode(true);
    this.eventLog = [];
  }

  /**
   * Inserts a key into the B+ Tree.
   * @param {number} key
   * @param {*} [value=null]
   * @returns {Object} split trace info
   */
  insert(key, value = null) {
    const numKey = Number(key);
    if (isNaN(numKey)) return { ok: false, error: 'Invalid key' };

    const splitsOccurred = [];
    const root = this.root;

    // If root is full, allocate a new root
    if (root.keys.length >= this.maxKeys) {
      const newRoot = new BPlusTreeNode(false);
      newRoot.children.push(this.root);
      this._splitChild(newRoot, 0, splitsOccurred);
      this.root = newRoot;
    }

    this._insertNonFull(this.root, numKey, value, splitsOccurred);

    const logEntry = {
      action: 'INSERT',
      key: numKey,
      splits: splitsOccurred,
      description: splitsOccurred.length > 0
        ? `Inserted key ${numKey} causing ${splitsOccurred.length} split(s).`
        : `Inserted key ${numKey} without split.`,
    };
    this.eventLog.push(logEntry);

    return { ok: true, splits: splitsOccurred, log: logEntry };
  }

  _insertNonFull(node, key, value, splitsOccurred) {
    if (node.isLeaf) {
      // Find insertion position to keep sorted
      let i = 0;
      while (i < node.keys.length && key > node.keys[i]) {
        i++;
      }
      // If duplicate key, overwrite or ignore
      if (i < node.keys.length && node.keys[i] === key) {
        return;
      }
      node.keys.splice(i, 0, key);
    } else {
      // Find which child subtree receives the key
      let i = 0;
      while (i < node.keys.length && key >= node.keys[i]) {
        i++;
      }

      const child = node.children[i];
      if (child.keys.length >= this.maxKeys) {
        this._splitChild(node, i, splitsOccurred);
        // After split, determine which of the two new children gets the key
        if (key >= node.keys[i]) {
          i++;
        }
      }
      this._insertNonFull(node.children[i], key, value, splitsOccurred);
    }
  }

  _splitChild(parent, index, splitsOccurred) {
    const child = parent.children[index];
    const isLeaf = child.isLeaf;
    const sibling = new BPlusTreeNode(isLeaf);

    if (isLeaf) {
      // Leaf split: keys split evenly.
      // Sibling gets upper half; middle key is COPIED up to parent.
      const mid = Math.floor(this.order / 2);
      sibling.keys = child.keys.splice(mid);
      const promotedKey = sibling.keys[0]; // copy-up: first key in right leaf

      // Maintain leaf sibling pointers
      sibling.next = child.next;
      sibling.prev = child;
      if (child.next) {
        child.next.prev = sibling;
      }
      child.next = sibling;

      // Insert promoted key into parent
      parent.keys.splice(index, 0, promotedKey);
      parent.children.splice(index + 1, 0, sibling);

      splitsOccurred.push({
        type: 'LEAF_SPLIT',
        promotedKey,
        leftKeys: [...child.keys],
        rightKeys: [...sibling.keys],
        description: `Leaf split: copied up key ${promotedKey} to parent index.`,
      });
    } else {
      // Internal split: middle key is PUSHED UP to parent (not retained in child).
      const mid = Math.floor(child.keys.length / 2);
      const promotedKey = child.keys[mid];

      sibling.keys = child.keys.slice(mid + 1);
      sibling.children = child.children.slice(mid + 1);

      child.keys = child.keys.slice(0, mid);
      child.children = child.children.slice(0, mid + 1);

      parent.keys.splice(index, 0, promotedKey);
      parent.children.splice(index + 1, 0, sibling);

      splitsOccurred.push({
        type: 'INTERNAL_SPLIT',
        promotedKey,
        leftKeys: [...child.keys],
        rightKeys: [...sibling.keys],
        description: `Internal node split: pushed up key ${promotedKey} to parent.`,
      });
    }
  }

  /**
   * Search for a key and return the full step-by-step traversal trace.
   * @param {number} key
   * @returns {Object} trace with visited nodes and match result
   */
  search(key) {
    const numKey = Number(key);
    const trace = [];
    let curr = this.root;

    while (curr) {
      if (curr.isLeaf) {
        const foundIndex = curr.keys.indexOf(numKey);
        trace.push({
          nodeId: curr.id,
          isLeaf: true,
          keys: [...curr.keys],
          targetKey: numKey,
          found: foundIndex !== -1,
          foundIndex,
          explanation: foundIndex !== -1
            ? `Key ${numKey} located at leaf node [${curr.keys.join(', ')}] at position ${foundIndex}!`
            : `Key ${numKey} not found in leaf node [${curr.keys.join(', ')}].`,
        });
        return {
          found: foundIndex !== -1,
          key: numKey,
          trace,
        };
      } else {
        // Internal node navigation
        let i = 0;
        while (i < curr.keys.length && numKey >= curr.keys[i]) {
          i++;
        }
        trace.push({
          nodeId: curr.id,
          isLeaf: false,
          keys: [...curr.keys],
          targetKey: numKey,
          childIndex: i,
          explanation: i === 0
            ? `${numKey} < ${curr.keys[0]} -> Follow leftmost child branch.`
            : i === curr.keys.length
            ? `${numKey} >= ${curr.keys[curr.keys.length - 1]} -> Follow rightmost child branch.`
            : `${curr.keys[i - 1]} <= ${numKey} < ${curr.keys[i]} -> Follow branch #${i + 1}.`,
        });
        curr = curr.children[i];
      }
    }

    return { found: false, key: numKey, trace };
  }

  /**
   * Performs a range scan from low to high using the leaf linked list.
   * @param {number} low
   * @param {number} high
   * @returns {Object}
   */
  rangeSearch(low, high) {
    const numLow = Number(low);
    const numHigh = Number(high);
    const result = [];
    const leavesVisited = [];

    // Traverse down to the leaf containing the lower bound
    let curr = this.root;
    while (curr && !curr.isLeaf) {
      let i = 0;
      while (i < curr.keys.length && numLow >= curr.keys[i]) {
        i++;
      }
      curr = curr.children[i];
    }

    // Now scan horizontally across leaf nodes
    let stop = false;
    while (curr && !stop) {
      leavesVisited.push({ id: curr.id, keys: [...curr.keys] });
      for (const k of curr.keys) {
        if (k >= numLow && k <= numHigh) {
          result.push(k);
        } else if (k > numHigh) {
          stop = true;
          break;
        }
      }
      curr = curr.next;
    }

    return {
      low: numLow,
      high: numHigh,
      keys: result,
      leavesVisited,
      count: result.length,
    };
  }

  /**
   * Returns a serializable tree structure with levels for UI rendering.
   */
  toHierarchy() {
    function serializeNode(node, level = 0) {
      if (!node) return null;
      return {
        id: node.id,
        level,
        isLeaf: node.isLeaf,
        keys: [...node.keys],
        hasNext: !!node.next,
        nextId: node.next?.id || null,
        children: node.children.map(c => serializeNode(c, level + 1)),
      };
    }

    // Build levels array (breadth-first)
    const levels = [];
    let currentLevel = [this.root];

    while (currentLevel.length > 0) {
      levels.push(currentLevel.map(n => ({
        id: n.id,
        isLeaf: n.isLeaf,
        keys: [...n.keys],
        nextId: n.next?.id || null,
      })));

      const nextLevel = [];
      for (const node of currentLevel) {
        if (!node.isLeaf && node.children) {
          nextLevel.push(...node.children);
        }
      }
      currentLevel = nextLevel;
    }

    return {
      order: this.order,
      maxKeys: this.maxKeys,
      root: serializeNode(this.root),
      levels,
    };
  }
}
