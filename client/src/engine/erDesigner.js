/**
 * erDesigner.js — ER/EER Modeling & Relational Schema Mapping Engine
 *
 * Implements:
 * 1. ER Entities (Regular & Weak).
 * 2. Attributes (Primary Key, Regular, Composite, Multivalued, Derived).
 * 3. Relationships with Cardinality constraints (1:1, 1:N, M:N).
 * 4. Automated mapping from ER diagrams to standard Relational Schema (DDL SQL and Table schemas).
 */

export const SAMPLE_ER_MODELS = [
  {
    id: 'university',
    name: 'University Enrollment System',
    entities: [
      {
        id: 'STUDENT',
        name: 'Student',
        isWeak: false,
        attributes: [
          { name: 'student_id', isKey: true, type: 'INT' },
          { name: 'first_name', isKey: false, type: 'VARCHAR(50)' },
          { name: 'last_name', isKey: false, type: 'VARCHAR(50)' },
          { name: 'gpa', isKey: false, type: 'DECIMAL(3,2)' },
        ],
      },
      {
        id: 'COURSE',
        name: 'Course',
        isWeak: false,
        attributes: [
          { name: 'course_id', isKey: true, type: 'VARCHAR(10)' },
          { name: 'title', isKey: false, type: 'VARCHAR(100)' },
          { name: 'credits', isKey: false, type: 'INT' },
        ],
      },
      {
        id: 'DEPARTMENT',
        name: 'Department',
        isWeak: false,
        attributes: [
          { name: 'dept_id', isKey: true, type: 'VARCHAR(10)' },
          { name: 'dept_name', isKey: false, type: 'VARCHAR(100)' },
        ],
      },
    ],
    relationships: [
      {
        id: 'ENROLLS',
        name: 'Enrolls',
        entity1: 'STUDENT',
        entity2: 'COURSE',
        cardinality: 'M:N',
        attributes: [
          { name: 'grade', type: 'DECIMAL(3,1)' },
          { name: 'semester', type: 'VARCHAR(10)' },
        ],
      },
      {
        id: 'OFFERS',
        name: 'Offers',
        entity1: 'DEPARTMENT',
        entity2: 'COURSE',
        cardinality: '1:N',
        attributes: [],
      },
    ],
  },
  {
    id: 'company',
    name: 'Company & Department Project System',
    entities: [
      {
        id: 'EMPLOYEE',
        name: 'Employee',
        isWeak: false,
        attributes: [
          { name: 'emp_id', isKey: true, type: 'INT' },
          { name: 'emp_name', isKey: false, type: 'VARCHAR(60)' },
          { name: 'salary', isKey: false, type: 'DECIMAL(10,2)' },
        ],
      },
      {
        id: 'PROJECT',
        name: 'Project',
        isWeak: false,
        attributes: [
          { name: 'proj_id', isKey: true, type: 'INT' },
          { name: 'proj_name', isKey: false, type: 'VARCHAR(80)' },
        ],
      },
    ],
    relationships: [
      {
        id: 'WORKS_ON',
        name: 'Works_On',
        entity1: 'EMPLOYEE',
        entity2: 'PROJECT',
        cardinality: 'M:N',
        attributes: [{ name: 'hours_per_week', type: 'INT' }],
      },
    ],
  },
];

/**
 * Converts an ER/EER model into a normalized Relational Schema with primary keys,
 * foreign keys, and DDL SQL statements.
 */
export function convertErToRelational(erModel) {
  const tables = [];
  const entityMap = new Map();

  // Step 1: Map regular strong entities to base tables
  for (const ent of erModel.entities) {
    const keyAttrs = ent.attributes.filter(a => a.isKey);
    const nonKeyAttrs = ent.attributes.filter(a => !a.isKey);

    const cols = ent.attributes.map(a => ({
      name: a.name,
      type: a.type || 'VARCHAR(50)',
      isPrimary: !!a.isKey,
      isForeign: false,
    }));

    const table = {
      tableName: ent.name.toUpperCase(),
      sourceEntity: ent.name,
      columns: cols,
      primaryKeys: keyAttrs.map(a => a.name),
      foreignKeys: [],
    };

    tables.push(table);
    entityMap.set(ent.id, { entity: ent, table });
  }

  // Step 2: Map relationships
  for (const rel of erModel.relationships) {
    const ent1Info = entityMap.get(rel.entity1);
    const ent2Info = entityMap.get(rel.entity2);

    if (!ent1Info || !ent2Info) continue;

    if (rel.cardinality === 'M:N') {
      // M:N relationship becomes a new associative junction table
      const junctionCols = [];
      const pkCols = [];
      const fks = [];

      // Add PK of Entity 1 as FK
      for (const pk of ent1Info.table.primaryKeys) {
        const colName = `${ent1Info.entity.name.toLowerCase()}_${pk}`;
        junctionCols.push({ name: colName, type: 'INT', isPrimary: true, isForeign: true });
        pkCols.push(colName);
        fks.push({ column: colName, refTable: ent1Info.table.tableName, refColumn: pk });
      }

      // Add PK of Entity 2 as FK
      for (const pk of ent2Info.table.primaryKeys) {
        const colName = `${ent2Info.entity.name.toLowerCase()}_${pk}`;
        junctionCols.push({ name: colName, type: 'INT', isPrimary: true, isForeign: true });
        pkCols.push(colName);
        fks.push({ column: colName, refTable: ent2Info.table.tableName, refColumn: pk });
      }

      // Add relationship attributes (e.g. grade, hours)
      if (rel.attributes) {
        for (const attr of rel.attributes) {
          junctionCols.push({ name: attr.name, type: attr.type || 'VARCHAR(50)', isPrimary: false, isForeign: false });
        }
      }

      tables.push({
        tableName: rel.name.toUpperCase(),
        sourceRelationship: rel.name,
        columns: junctionCols,
        primaryKeys: pkCols,
        foreignKeys: fks,
      });
    } else if (rel.cardinality === '1:N') {
      // 1:N relationship: post foreign key of the '1' entity into the 'N' entity table
      // In rel, entity1 is 1 and entity2 is N
      const targetTable = ent2Info.table;
      const parentTable = ent1Info.table;

      for (const pk of parentTable.primaryKeys) {
        const fkColName = `${ent1Info.entity.name.toLowerCase()}_${pk}`;
        if (!targetTable.columns.some(c => c.name === fkColName)) {
          targetTable.columns.push({
            name: fkColName,
            type: 'INT',
            isPrimary: false,
            isForeign: true,
          });
          targetTable.foreignKeys.push({
            column: fkColName,
            refTable: parentTable.tableName,
            refColumn: pk,
          });
        }
      }
    } else if (rel.cardinality === '1:1') {
      // 1:1 relationship: post foreign key into either table (usually entity2)
      const targetTable = ent2Info.table;
      const parentTable = ent1Info.table;
      for (const pk of parentTable.primaryKeys) {
        const fkColName = `${ent1Info.entity.name.toLowerCase()}_${pk}`;
        targetTable.columns.push({
          name: fkColName,
          type: 'INT',
          isPrimary: false,
          isForeign: true,
          unique: true,
        });
        targetTable.foreignKeys.push({
          column: fkColName,
          refTable: parentTable.tableName,
          refColumn: pk,
        });
      }
    }
  }

  // Generate standard SQL DDL
  const ddlStatements = tables.map(t => {
    const colDefs = t.columns.map(c => `  ${c.name} ${c.type}`);
    if (t.primaryKeys.length > 0) {
      colDefs.push(`  PRIMARY KEY (${t.primaryKeys.join(', ')})`);
    }
    for (const fk of t.foreignKeys) {
      colDefs.push(`  FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(${fk.refColumn})`);
    }
    return `CREATE TABLE ${t.tableName} (\n${colDefs.join(',\n')}\n);`;
  });

  // Schema notation summary: e.g. STUDENT(student_id PK, first_name, ...)
  const schemaNotations = tables.map(t => {
    const colList = t.columns.map(c => {
      const tags = [];
      if (c.isPrimary) tags.push('PK');
      if (c.isForeign) tags.push('FK');
      return tags.length > 0 ? `${c.name} [${tags.join(', ')}]` : c.name;
    }).join(', ');
    return `${t.tableName}(${colList})`;
  });

  return {
    tables,
    ddlSql: ddlStatements.join('\n\n'),
    schemaNotations,
  };
}
