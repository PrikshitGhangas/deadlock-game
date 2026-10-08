/**
 * multiGranularity.js — Multiple Granularity Locking (MGL) Protocol Engine
 *
 * Implements:
 * 1. Tree hierarchy: Database -> Tables -> Pages -> Rows.
 * 2. Five lock modes: IS, IX, S, SIX, X.
 * 3. Lock compatibility matrix checks.
 * 4. Strict MGL top-down locking and bottom-up unlocking rules.
 * 5. Explanations for lock conflicts and protocol rule violations.
 */

export const LOCK_MODES = ['IS', 'IX', 'S', 'SIX', 'X'];

/**
 * Compatibility matrix:
 * COMPATIBILITY[requested][held] === true if compatible, false if conflict
 */
export const COMPATIBILITY = {
  IS:  { IS: true,  IX: true,  S: true,  SIX: true,  X: false },
  IX:  { IS: true,  IX: true,  S: false, SIX: false, X: false },
  S:   { IS: true,  IX: false, S: true,  SIX: false, X: false },
  SIX: { IS: true,  IX: false, S: false, SIX: false, X: false },
  X:   { IS: false, IX: false, S: false, SIX: false, X: false },
};

export const DEFAULT_MGL_HIERARCHY = {
  id: 'DB',
  name: 'Database (UniDB)',
  type: 'DATABASE',
  children: [
    {
      id: 'T_STUDENT',
      name: 'Table: Student',
      type: 'TABLE',
      children: [
        {
          id: 'P_STUDENT_1',
          name: 'Page 1',
          type: 'PAGE',
          children: [
            { id: 'R_STUDENT_101', name: 'Row 101 (Alice)', type: 'ROW' },
            { id: 'R_STUDENT_102', name: 'Row 102 (Bob)', type: 'ROW' },
          ],
        },
        {
          id: 'P_STUDENT_2',
          name: 'Page 2',
          type: 'PAGE',
          children: [
            { id: 'R_STUDENT_103', name: 'Row 103 (Charlie)', type: 'ROW' },
          ],
        },
      ],
    },
    {
      id: 'T_COURSE',
      name: 'Table: Course',
      type: 'TABLE',
      children: [
        {
          id: 'P_COURSE_1',
          name: 'Page 1',
          type: 'PAGE',
          children: [
            { id: 'R_COURSE_CS101', name: 'Row CS101 (Intro CS)', type: 'ROW' },
            { id: 'R_COURSE_CS202', name: 'Row CS202 (DBMS)', type: 'ROW' },
          ],
        },
      ],
    },
  ],
};

export class MultiGranularityManager {
  constructor(hierarchy = DEFAULT_MGL_HIERARCHY) {
    this.hierarchy = JSON.parse(JSON.stringify(hierarchy));
    /**
     * Map of nodeId -> Map of txnId -> lockMode
     * e.g. { 'DB': { 'T1': 'IX' }, 'T_STUDENT': { 'T1': 'IX' } }
     */
    this.nodeLocks = new Map();
    this.parentMap = new Map();
    this.childMap = new Map();
    this._indexTree(this.hierarchy, null);
  }

  _indexTree(node, parentId) {
    if (parentId) {
      this.parentMap.set(node.id, parentId);
      if (!this.childMap.has(parentId)) this.childMap.set(parentId, []);
      this.childMap.get(parentId).push(node.id);
    }
    if (!this.nodeLocks.has(node.id)) {
      this.nodeLocks.set(node.id, new Map());
    }
    if (node.children) {
      for (const child of node.children) {
        this._indexTree(child, node.id);
      }
    }
  }

  getLocksOnNode(nodeId) {
    const map = this.nodeLocks.get(nodeId);
    if (!map) return [];
    return Array.from(map.entries()).map(([txn, mode]) => ({ txn, mode }));
  }

  /**
   * Checks if requesting a lock on nodeId by txn is allowed by MGL protocol.
   */
  canAcquire(txn, nodeId, mode) {
    const requested = mode.toUpperCase();
    if (!LOCK_MODES.includes(requested)) {
      return { allowed: false, reason: `Unknown lock mode: ${mode}` };
    }

    // 1. Compatibility check with currently held locks on this exact node
    const currentLocks = this.nodeLocks.get(nodeId) || new Map();
    for (const [holderTxn, heldMode] of currentLocks.entries()) {
      if (holderTxn !== txn) {
        const isCompatible = COMPATIBILITY[requested]?.[heldMode];
        if (!isCompatible) {
          return {
            allowed: false,
            reason: `Direct Lock Conflict: ${txn} requests ${requested} on ${nodeId}, but ${holderTxn} already holds ${heldMode}. Modes ${requested} and ${heldMode} are incompatible.`,
          };
        }
      }
    }

    // 2. MGL Top-Down Rule: Ancestor prerequisite check
    const parentId = this.parentMap.get(nodeId);
    if (parentId) {
      const parentLocks = this.nodeLocks.get(parentId) || new Map();
      const parentMode = parentLocks.get(txn);

      if (requested === 'S' || requested === 'IS') {
        // Must hold IS or IX on parent
        if (parentMode !== 'IS' && parentMode !== 'IX') {
          return {
            allowed: false,
            reason: `MGL Top-Down Protocol Violation: To acquire ${requested} on node ${nodeId}, ${txn} must first hold intention lock (IS or IX) on parent ${parentId}. Current parent lock: ${parentMode || 'None'}.`,
          };
        }
      } else if (requested === 'X' || requested === 'IX' || requested === 'SIX') {
        // Must hold IX or SIX on parent
        if (parentMode !== 'IX' && parentMode !== 'SIX') {
          return {
            allowed: false,
            reason: `MGL Top-Down Protocol Violation: To acquire ${requested} on node ${nodeId}, ${txn} must first hold intention lock (IX or SIX) on parent ${parentId}. Current parent lock: ${parentMode || 'None'}.`,
          };
        }
      }
    }

    // 3. Subtree descendant conflict check:
    // If requesting X or S, ensure no descendant holds incompatible locks from other transactions
    if (requested === 'X' || requested === 'S') {
      const descendantConflict = this._checkDescendants(nodeId, txn, requested);
      if (descendantConflict) return descendantConflict;
    }

    return { allowed: true, reason: `Lock ${requested} on ${nodeId} is compatible and complies with MGL protocol.` };
  }

  _checkDescendants(nodeId, txn, requested) {
    const children = this.childMap.get(nodeId) || [];
    for (const childId of children) {
      const locks = this.nodeLocks.get(childId) || new Map();
      for (const [holderTxn, heldMode] of locks.entries()) {
        if (holderTxn !== txn && !COMPATIBILITY[requested][heldMode]) {
          return {
            allowed: false,
            reason: `Descendant Conflict: Cannot grant ${requested} on ${nodeId} because ${holderTxn} holds ${heldMode} on lower-level node ${childId}.`,
          };
        }
      }
      const deepCheck = this._checkDescendants(childId, txn, requested);
      if (deepCheck) return deepCheck;
    }
    return null;
  }

  /**
   * Acquire lock if allowed.
   */
  requestLock(txn, nodeId, mode) {
    const check = this.canAcquire(txn, nodeId, mode);
    if (!check.allowed) {
      return { ok: false, error: check.reason };
    }

    this.nodeLocks.get(nodeId).set(txn, mode.toUpperCase());
    return { ok: true, message: `Successfully granted ${mode.toUpperCase()} on ${nodeId} to ${txn}.` };
  }

  /**
   * Release lock following bottom-up protocol.
   */
  releaseLock(txn, nodeId) {
    const locks = this.nodeLocks.get(nodeId);
    if (!locks || !locks.has(txn)) {
      return { ok: false, error: `${txn} does not hold any lock on ${nodeId}.` };
    }

    // Bottom-Up Rule: Cannot release parent lock if any child is currently locked by this txn
    const lockedDescendant = this._findLockedDescendant(nodeId, txn);
    if (lockedDescendant) {
      return {
        ok: false,
        error: `MGL Bottom-Up Protocol Violation: Cannot release lock on ${nodeId} while descendant ${lockedDescendant} is still locked by ${txn}. Locks must be released bottom-up!`,
      };
    }

    locks.delete(txn);
    return { ok: true, message: `Released lock on ${nodeId} for ${txn}.` };
  }

  _findLockedDescendant(nodeId, txn) {
    const children = this.childMap.get(nodeId) || [];
    for (const childId of children) {
      const childLocks = this.nodeLocks.get(childId) || new Map();
      if (childLocks.has(txn)) return childId;
      const deep = this._findLockedDescendant(childId, txn);
      if (deep) return deep;
    }
    return null;
  }

  getSnapshot() {
    const result = {};
    for (const [nodeId, locksMap] of this.nodeLocks.entries()) {
      result[nodeId] = Array.from(locksMap.entries()).map(([txn, mode]) => ({ txn, mode }));
    }
    return result;
  }
}
