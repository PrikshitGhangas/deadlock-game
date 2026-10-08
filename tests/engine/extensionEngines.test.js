import { describe, it, expect } from 'vitest';
import {
  analyzeConflictSerializability,
  generateRandomSchedule,
  parseScheduleOperations,
} from '../../client/src/engine/precedenceGraph.js';
import {
  convertErToRelational,
  SAMPLE_ER_MODELS,
} from '../../client/src/engine/erDesigner.js';
import { BPlusTree } from '../../client/src/engine/bPlusTree.js';
import {
  parseSqlQuery,
  optimizeQuery,
  SAMPLE_QUERIES,
} from '../../client/src/engine/queryOptimizer.js';
import {
  simulateTimestampOrdering,
  SAMPLE_TO_SCHEDULES,
} from '../../client/src/engine/timestampOrdering.js';
import {
  MultiGranularityManager,
  COMPATIBILITY,
} from '../../client/src/engine/multiGranularity.js';
import {
  computeClosure,
  findCandidateKeys,
  analyzeNormalization,
} from '../../client/src/engine/normalization.js';
import { compareConcurrencyAlgorithms } from '../../client/src/engine/algorithmCompare.js';

describe('Precedence Graph & Conflict Serializability', () => {
  it('detects conflict serializable schedule and topological order', () => {
    // Schedule: T1: R(A), T2: W(A), T1: COMMIT, T2: COMMIT
    // Conflict: T1 R(A) -> T2 W(A) implies T1 -> T2. No cycle!
    const schedule = 'T1: R(A)\nT2: W(A)';
    const result = analyzeConflictSerializability(schedule);
    expect(result.isConflictSerializable).toBe(true);
    expect(result.hasCycle).toBe(false);
    expect(result.equivalentSerialSchedule).toBe('T1 -> T2');
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].type).toBe('R-W');
  });

  it('detects cycle in non-serializable schedule', () => {
    // Classic non-serializable schedule:
    // T1: R(A), T2: W(A), T2: W(B), T1: R(B)
    // T1 -> T2 (on A), T2 -> T1 (on B) => Cycle T1 -> T2 -> T1
    const schedule = 'T1: R(A)\nT2: W(A)\nT2: W(B)\nT1: R(B)';
    const result = analyzeConflictSerializability(schedule);
    expect(result.isConflictSerializable).toBe(false);
    expect(result.hasCycle).toBe(true);
    expect(result.cycles.length).toBeGreaterThan(0);
    expect(result.equivalentSerialSchedule).toBeNull();
  });

  it('handles compact schedule notation R1(A) W2(A)', () => {
    const result = analyzeConflictSerializability('R1(A) W2(A)');
    expect(result.isConflictSerializable).toBe(true);
    expect(result.equivalentSerialSchedule).toBe('T1 -> T2');
  });

  it('generates random schedules deterministically when seed is provided', () => {
    const run1 = generateRandomSchedule({ numTxns: 3, numItems: 3, numOps: 6, seed: 42 });
    const run2 = generateRandomSchedule({ numTxns: 3, numItems: 3, numOps: 6, seed: 42 });
    expect(run1.scheduleText).toBe(run2.scheduleText);
    expect(typeof run1.analysis.isConflictSerializable).toBe('boolean');
  });
});

describe('ER/EER Designer & Relational Schema Mapping', () => {
  it('converts entities to base tables and relationships to junction tables', () => {
    const res = convertErToRelational(SAMPLE_ER_MODELS[0]);
    expect(res.tables.length).toBe(4); // Student, Course, Department, and Enrolls (M:N junction)
    const enrollsTable = res.tables.find(t => t.tableName === 'ENROLLS');
    expect(enrollsTable).toBeDefined();
    expect(enrollsTable.primaryKeys).toContain('student_student_id');
    expect(enrollsTable.primaryKeys).toContain('course_course_id');
    expect(res.ddlSql).toContain('CREATE TABLE STUDENT');
    expect(res.ddlSql).toContain('CREATE TABLE ENROLLS');
    expect(res.schemaNotations.length).toBe(4);
  });

  it('correctly posts foreign keys for 1:N relationship', () => {
    const res = convertErToRelational(SAMPLE_ER_MODELS[0]);
    // Department 1:N Course => Course table gets department_dept_id FK
    const courseTable = res.tables.find(t => t.tableName === 'COURSE');
    expect(courseTable).toBeDefined();
    expect(courseTable.columns.some(c => c.name === 'department_dept_id')).toBe(true);
  });
});

describe('B+ Tree Index Engine', () => {
  it('inserts keys and splits nodes as order limit is reached', () => {
    const bpt = new BPlusTree(3); // max keys per node = 2
    bpt.insert(10);
    bpt.insert(20);
    expect(bpt.root.keys).toEqual([10, 20]);

    // Inserting 30 triggers leaf split and root creation
    const insertRes = bpt.insert(30);
    expect(insertRes.splits.length).toBeGreaterThan(0);
    expect(bpt.root.isLeaf).toBe(false);

    // Search existing and non-existing keys
    const s20 = bpt.search(20);
    expect(s20.found).toBe(true);
    expect(s20.trace.length).toBeGreaterThanOrEqual(2);

    const s99 = bpt.search(99);
    expect(s99.found).toBe(false);
  });

  it('performs range query across leaf nodes', () => {
    const bpt = new BPlusTree(3);
    const keys = [5, 10, 15, 20, 25, 30];
    keys.forEach(k => bpt.insert(k));

    const range = bpt.rangeSearch(10, 25);
    expect(range.keys).toEqual([10, 15, 20, 25]);
  });
});

describe('Relational Algebra & Query Tree Optimizer', () => {
  it('parses SQL query into components', () => {
    const parsed = parseSqlQuery(SAMPLE_QUERIES[0].sql);
    expect(parsed.projections).toEqual(['S.name']);
    expect(parsed.tables.length).toBe(2);
    expect(parsed.joinConditions.length).toBe(1);
    expect(parsed.selections.length).toBe(1);
  });

  it('builds canonical and optimized trees with cost savings', () => {
    const opt = optimizeQuery(SAMPLE_QUERIES[0].sql);
    expect(opt.unoptimizedTree.type).toBe('PROJECTION');
    expect(opt.optimizedTree.type).toBe('PROJECTION');
    expect(opt.rulesApplied.length).toBe(3);
    expect(typeof opt.cost.estimatedSavings).toBe('string');
  });
});

describe('Timestamp Ordering Concurrency', () => {
  it('allows serializable operations and updates timestamps', () => {
    const sim = simulateTimestampOrdering({ schedule: SAMPLE_TO_SCHEDULES.serializable });
    expect(sim.totalAborts).toBe(0);
    expect(sim.committedTxns.length).toBe(2);
  });

  it('aborts out-of-order read in Basic TO', () => {
    const sim = simulateTimestampOrdering({ schedule: SAMPLE_TO_SCHEDULES.aborted_read });
    expect(sim.totalAborts).toBe(1);
    expect(sim.abortedTxns).toContain('T1');
  });

  it('applies Thomas Write Rule to ignore obsolete writes instead of aborting', () => {
    const basicSim = simulateTimestampOrdering({
      schedule: SAMPLE_TO_SCHEDULES.thomas_write,
      useThomasWriteRule: false,
    });
    expect(basicSim.totalAborts).toBe(1);

    const twrSim = simulateTimestampOrdering({
      schedule: SAMPLE_TO_SCHEDULES.thomas_write,
      useThomasWriteRule: true,
    });
    expect(twrSim.totalAborts).toBe(0);
    const ignoreStep = twrSim.steps.find(s => s.decision === 'IGNORE');
    expect(ignoreStep).toBeDefined();
  });
});

describe('Multiple Granularity Locking (MGL)', () => {
  it('enforces compatibility matrix', () => {
    expect(COMPATIBILITY.IS.IS).toBe(true);
    expect(COMPATIBILITY.IS.X).toBe(false);
    expect(COMPATIBILITY.S.IX).toBe(false);
    expect(COMPATIBILITY.X.X).toBe(false);
  });

  it('enforces top-down intention lock protocol', () => {
    const mgl = new MultiGranularityManager();
    // T1 wants X on Row R_STUDENT_101.
    // Must fail if T1 does not hold IX on parent Page P_STUDENT_1!
    const check1 = mgl.canAcquire('T1', 'R_STUDENT_101', 'X');
    expect(check1.allowed).toBe(false);
    expect(check1.reason).toContain('MGL Top-Down Protocol Violation');

    // Acquire proper top-down hierarchy: DB(IX) -> Table(IX) -> Page(IX) -> Row(X)
    expect(mgl.requestLock('T1', 'DB', 'IX').ok).toBe(true);
    expect(mgl.requestLock('T1', 'T_STUDENT', 'IX').ok).toBe(true);
    expect(mgl.requestLock('T1', 'P_STUDENT_1', 'IX').ok).toBe(true);
    expect(mgl.requestLock('T1', 'R_STUDENT_101', 'X').ok).toBe(true);
  });

  it('enforces bottom-up unlock protocol', () => {
    const mgl = new MultiGranularityManager();
    mgl.requestLock('T1', 'DB', 'IX');
    mgl.requestLock('T1', 'T_STUDENT', 'IX');
    mgl.requestLock('T1', 'P_STUDENT_1', 'IX');
    mgl.requestLock('T1', 'R_STUDENT_101', 'X');

    // Attempting to release Page while Row is locked must fail!
    const releasePage = mgl.releaseLock('T1', 'P_STUDENT_1');
    expect(releasePage.ok).toBe(false);
    expect(releasePage.error).toContain('Bottom-Up Protocol Violation');

    // Releasing row first then page succeeds
    expect(mgl.releaseLock('T1', 'R_STUDENT_101').ok).toBe(true);
    expect(mgl.releaseLock('T1', 'P_STUDENT_1').ok).toBe(true);
  });
});

describe('Functional Dependency & Normalization Analyzer', () => {
  it('computes attribute closure X+', () => {
    const fds = [
      { lhs: ['A'], rhs: ['B'] },
      { lhs: ['B'], rhs: ['C'] },
    ];
    const closureA = computeClosure(['A'], fds);
    expect(closureA).toEqual(['A', 'B', 'C']);
  });

  it('identifies candidate keys and 2NF partial dependency violation', () => {
    const schema = 'StudentID, CourseID, StudentName, CourseName';
    const fds = 'StudentID -> StudentName\nCourseID -> CourseName';
    const analysis = analyzeNormalization(schema, fds);
    expect(analysis.candidateKeysFormatted).toEqual(['{CourseID, StudentID}']);
    expect(analysis.highestNormalForm).toBe('1NF');
    expect(analysis.normalForms['2NF'].valid).toBe(false);
    expect(analysis.normalForms['2NF'].violations.length).toBe(2);
  });

  it('identifies 3NF transitive dependency violation', () => {
    const schema = 'EmpID, EmpName, DeptID, DeptName';
    const fds = 'EmpID -> EmpName, DeptID\nDeptID -> DeptName';
    const analysis = analyzeNormalization(schema, fds);
    expect(analysis.candidateKeysFormatted).toEqual(['{EmpID}']);
    expect(analysis.normalForms['2NF'].valid).toBe(true);
    expect(analysis.normalForms['3NF'].valid).toBe(false);
    expect(analysis.highestNormalForm).toBe('2NF');
  });

  it('identifies clean BCNF relation', () => {
    const schema = 'StudentID, Email';
    const fds = 'StudentID -> Email\nEmail -> StudentID';
    const analysis = analyzeNormalization(schema, fds);
    expect(analysis.highestNormalForm).toBe('BCNF');
    expect(analysis.normalForms['BCNF'].valid).toBe(true);
  });
});

describe('Concurrency Algorithm Comparison Mode', () => {
  it('runs schedule across all algorithms and produces comparative report', () => {
    const schedule = [
      'T1: LOCK-X(A)',
      'T2: LOCK-X(B)',
      'T1: LOCK-X(B)',
      'T2: LOCK-X(A)',
    ].join('\n');

    const result = compareConcurrencyAlgorithms(schedule);
    expect(result.ok).toBe(true);
    expect(result.algorithms.length).toBe(5);
    expect(result.serializability).toBeDefined();
    expect(result.algorithms[0].name).toContain('Deadlock Detection');
    expect(result.algorithms[1].name).toContain('Wait-Die');
    expect(result.algorithms[2].name).toContain('Wound-Wait');
  });
});
