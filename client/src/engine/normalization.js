/**
 * normalization.js — Functional Dependency & Normalization Analyzer (1NF -> 2NF -> 3NF -> BCNF)
 *
 * Implements:
 * 1. Functional dependency parsing.
 * 2. Attribute closure algorithm (X+).
 * 3. Minimal candidate keys determination.
 * 4. Prime vs. Non-prime attribute categorization.
 * 5. Normal form verification:
 *    - 1NF (Atomicity)
 *    - 2NF (No partial dependencies)
 *    - 3NF (No transitive dependencies: X is superkey OR Y is prime)
 *    - BCNF (Every determinant X is a superkey)
 * 6. Educational diagnostic reporting of violating dependencies.
 */

export const SAMPLE_SCHEMAS = [
  {
    name: 'Student-Course-Faculty (2NF Violation)',
    attributes: 'StudentID, CourseID, StudentName, CourseName, Faculty, FacultyPhone',
    fds: [
      'StudentID -> StudentName',
      'CourseID -> CourseName, Faculty',
      'Faculty -> FacultyPhone',
    ].join('\n'),
  },
  {
    name: 'Employee-Department (3NF Violation)',
    attributes: 'EmpID, EmpName, DeptID, DeptName, DeptLocation',
    fds: [
      'EmpID -> EmpName, DeptID',
      'DeptID -> DeptName, DeptLocation',
    ].join('\n'),
  },
  {
    name: 'Student-Advisor (BCNF Violation)',
    attributes: 'StudentID, Subject, Advisor',
    fds: [
      'StudentID, Subject -> Advisor',
      'Advisor -> Subject',
    ].join('\n'),
  },
  {
    name: 'Clean BCNF Relation',
    attributes: 'StudentID, Email, FullName',
    fds: [
      'StudentID -> Email, FullName',
      'Email -> StudentID, FullName',
    ].join('\n'),
  },
];

/**
 * Parses functional dependency string:
 * e.g. "A, B -> C, D" or "StudentID -> StudentName"
 */
export function parseFds(text) {
  const lines = String(text ?? '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('--'));
  const fds = [];

  for (const line of lines) {
    const parts = line.split(/->|→/);
    if (parts.length === 2) {
      const lhs = parts[0].split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
      const rhs = parts[1].split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
      if (lhs.length > 0 && rhs.length > 0) {
        fds.push({
          lhs,
          rhs,
          raw: `${lhs.join(', ')} -> ${rhs.join(', ')}`,
        });
      }
    }
  }

  return fds;
}

export function parseAttributes(attrInput) {
  if (Array.isArray(attrInput)) return attrInput.map(s => String(s).trim()).filter(Boolean);
  return String(attrInput ?? '')
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Computes attribute closure X+ under a set of functional dependencies.
 *
 * @param {string[]|string} attributes - Starting attribute set X
 * @param {Array} fds - Parsed functional dependencies
 * @returns {string[]} sorted closure set X+
 */
export function computeClosure(attributes, fds) {
  const current = new Set(parseAttributes(attributes));
  let changed = true;

  while (changed) {
    changed = false;
    for (const fd of fds) {
      // Check if fd.lhs is subset of current
      const lhsInCurrent = fd.lhs.every(a => current.has(a));
      if (lhsInCurrent) {
        for (const rightAttr of fd.rhs) {
          if (!current.has(rightAttr)) {
            current.add(rightAttr);
            changed = true;
          }
        }
      }
    }
  }

  return Array.from(current).sort();
}

/**
 * Finds all candidate keys for a given relation and FD set.
 */
export function findCandidateKeys(allAttrs, fds) {
  const attrs = parseAttributes(allAttrs);
  const total = attrs.length;
  const superkeys = [];
  const candidateKeys = [];

  // Generate powerset ordered by size (1 to total)
  const subsets = [];
  for (let mask = 1; mask < (1 << total); mask++) {
    const subset = [];
    for (let i = 0; i < total; i++) {
      if ((mask & (1 << i)) !== 0) {
        subset.push(attrs[i]);
      }
    }
    subsets.push(subset);
  }

  // Sort subsets ascending by size
  subsets.sort((a, b) => a.length - b.length);

  for (const sub of subsets) {
    const closure = computeClosure(sub, fds);
    const isSuperkey = attrs.every(a => closure.includes(a));
    if (isSuperkey) {
      superkeys.push(sub);
      // Candidate key if no proper subset is already a superkey
      const isMinimal = !candidateKeys.some(ck => ck.every(k => sub.includes(k)));
      if (isMinimal) {
        candidateKeys.push(sub);
      }
    }
  }

  return {
    candidateKeys: candidateKeys.map(k => k.sort()),
    superkeys: superkeys.map(k => k.sort()),
  };
}

/**
 * Complete analysis of Normal Forms: 1NF, 2NF, 3NF, BCNF.
 */
export function analyzeNormalization(attributeInput, fdInput) {
  const attributes = parseAttributes(attributeInput);
  const fds = Array.isArray(fdInput) ? fdInput : parseFds(fdInput);

  if (attributes.length === 0) {
    return { error: 'No attributes specified.' };
  }

  const { candidateKeys, superkeys } = findCandidateKeys(attributes, fds);

  // Prime attributes: belong to at least one candidate key
  const primeAttrSet = new Set();
  candidateKeys.forEach(ck => ck.forEach(a => primeAttrSet.add(a)));
  const primeAttributes = Array.from(primeAttrSet).sort();
  const nonPrimeAttributes = attributes.filter(a => !primeAttrSet.has(a)).sort();

  // Helper: check if attribute set is superkey
  function isSuperkey(attrSet) {
    const closure = computeClosure(attrSet, fds);
    return attributes.every(a => closure.includes(a));
  }

  // Normal Form Checks:
  // 1NF: Always true for relational model
  const oneNF = { valid: true, reasons: ['All attributes are assumed atomic (1NF satisfied).'] };

  // 2NF: No partial dependencies
  // A partial dependency occurs when a non-prime attribute depends on a PROPER SUBSET of ANY candidate key
  const partialDependencies = [];
  for (const fd of fds) {
    for (const nonPrime of fd.rhs) {
      if (nonPrimeAttributes.includes(nonPrime)) {
        for (const ck of candidateKeys) {
          const isProperSubset = fd.lhs.length < ck.length && fd.lhs.every(a => ck.includes(a));
          if (isProperSubset) {
            partialDependencies.push({
              fd: fd.raw,
              candidateKey: ck.join(', '),
              violatingAttr: nonPrime,
              reason: `Non-prime attribute '${nonPrime}' depends on proper subset {${fd.lhs.join(', ')}} of candidate key {${ck.join(', ')}}.`,
            });
          }
        }
      }
    }
  }

  const twoNF = {
    valid: partialDependencies.length === 0,
    violations: partialDependencies,
  };

  // 3NF: For every non-trivial X -> Y:
  // Either X is a superkey OR Y is prime (all attributes in Y are prime)
  const transitiveViolations = [];
  for (const fd of fds) {
    const isTrivial = fd.rhs.every(a => fd.lhs.includes(a));
    if (!isTrivial) {
      const lhsSuper = isSuperkey(fd.lhs);
      const rhsAllPrime = fd.rhs.every(a => primeAttributes.includes(a));

      if (!lhsSuper && !rhsAllPrime) {
        const nonPrimeRhs = fd.rhs.filter(a => !primeAttributes.includes(a));
        transitiveViolations.push({
          fd: fd.raw,
          reason: `In '${fd.raw}', determinant {${fd.lhs.join(', ')}} is NOT a superkey, and {${nonPrimeRhs.join(', ')}} are not prime attributes.`,
        });
      }
    }
  }

  const threeNF = {
    valid: twoNF.valid && transitiveViolations.length === 0,
    violations: transitiveViolations,
  };

  // BCNF: For every non-trivial X -> Y, X must be a superkey
  const bcnfViolations = [];
  for (const fd of fds) {
    const isTrivial = fd.rhs.every(a => fd.lhs.includes(a));
    if (!isTrivial) {
      if (!isSuperkey(fd.lhs)) {
        bcnfViolations.push({
          fd: fd.raw,
          reason: `Determinant {${fd.lhs.join(', ')}} is NOT a superkey.`,
        });
      }
    }
  }

  const bcnf = {
    valid: threeNF.valid && bcnfViolations.length === 0,
    violations: bcnfViolations,
  };

  // Determine highest normal form
  let highestNormalForm = '1NF';
  if (twoNF.valid) highestNormalForm = '2NF';
  if (twoNF.valid && threeNF.valid) highestNormalForm = '3NF';
  if (twoNF.valid && threeNF.valid && bcnf.valid) highestNormalForm = 'BCNF';

  return {
    attributes,
    fds,
    candidateKeys,
    candidateKeysFormatted: candidateKeys.map(k => `{${k.join(', ')}}`),
    primeAttributes,
    nonPrimeAttributes,
    highestNormalForm,
    normalForms: {
      '1NF': oneNF,
      '2NF': twoNF,
      '3NF': threeNF,
      'BCNF': bcnf,
    },
    summary: `Relation reaches ${highestNormalForm}. Candidate keys: ${candidateKeys.map(k => `{${k.join(', ')}}`).join(', ') || 'None found'}.`,
  };
}
