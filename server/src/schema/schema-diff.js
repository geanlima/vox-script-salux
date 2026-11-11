function normalizeTableName(table) {
  return String(table.table ?? table).trim().toUpperCase();
}

function comparePrimaryKeys(sourcePk, targetPk) {
  const source = sourcePk.map((name) => name.toUpperCase());
  const target = targetPk.map((name) => name.toUpperCase());

  if (source.join(',') === target.join(',')) {
    return [];
  }

  return [
    {
      field: 'primaryKey',
      sourceValue: source.join(', ') || '(nenhuma)',
      targetValue: target.join(', ') || '(nenhuma)',
      message: 'Chave primária diferente'
    }
  ];
}

function columnMap(columns) {
  return new Map(columns.map((column) => [column.name.toUpperCase(), column]));
}

function compareColumns(sourceColumns, targetColumns) {
  const sourceMap = columnMap(sourceColumns);
  const targetMap = columnMap(targetColumns);
  const allNames = new Set([...sourceMap.keys(), ...targetMap.keys()]);
  const differences = [];

  for (const name of [...allNames].sort()) {
    const sourceCol = sourceMap.get(name);
    const targetCol = targetMap.get(name);

    if (!sourceCol) {
      differences.push({
        column: name,
        status: 'only_target',
        message: `Coluna existe apenas no destino`,
        targetValue: formatColumn(targetCol)
      });
      continue;
    }

    if (!targetCol) {
      differences.push({
        column: name,
        status: 'only_source',
        message: `Coluna existe apenas na origem`,
        sourceValue: formatColumn(sourceCol)
      });
      continue;
    }

    const fieldDiffs = [];

    if (sourceCol.dataType !== targetCol.dataType) {
      fieldDiffs.push({
        field: 'dataType',
        sourceValue: sourceCol.dataType,
        targetValue: targetCol.dataType,
        message: 'Tipo de dado diferente'
      });
    }

    if (sourceCol.nullable !== targetCol.nullable) {
      fieldDiffs.push({
        field: 'nullable',
        sourceValue: sourceCol.nullable ? 'NULL' : 'NOT NULL',
        targetValue: targetCol.nullable ? 'NULL' : 'NOT NULL',
        message: 'Nullable diferente'
      });
    }

    const sourceDefault = normalizeDefault(sourceCol.defaultValue);
    const targetDefault = normalizeDefault(targetCol.defaultValue);

    if (sourceDefault !== targetDefault) {
      fieldDiffs.push({
        field: 'defaultValue',
        sourceValue: sourceDefault ?? '(sem default)',
        targetValue: targetDefault ?? '(sem default)',
        message: 'Valor default diferente'
      });
    }

    if (fieldDiffs.length > 0) {
      differences.push({
        column: name,
        status: 'changed',
        message: `${fieldDiffs.length} diferença(s) na coluna`,
        fields: fieldDiffs,
        sourceValue: formatColumn(sourceCol),
        targetValue: formatColumn(targetCol)
      });
    }
  }

  return differences;
}

function formatColumn(column) {
  const nullable = column.nullable ? 'NULL' : 'NOT NULL';
  const defaultPart = column.defaultValue ? ` DEFAULT ${column.defaultValue}` : '';
  return `${column.dataType} ${nullable}${defaultPart}`;
}

function normalizeDefault(value) {
  if (value == null || value === '') {
    return null;
  }
  return String(value).trim().replace(/\s+/g, ' ');
}

export function compareTableMetadata(source, target) {
  const columnDiffs = compareColumns(source.columns, target.columns);
  const pkDiffs = comparePrimaryKeys(source.primaryKey, target.primaryKey);
  const hasDifferences = columnDiffs.length > 0 || pkDiffs.length > 0;

  return {
    table: source.table,
    schema: { source: source.schema, target: target.schema },
    status: hasDifferences ? 'different' : 'equal',
    columnDiffs,
    constraintDiffs: pkDiffs,
    summary: hasDifferences
      ? `${columnDiffs.length} diferença(s) de coluna, ${pkDiffs.length} de constraint`
      : 'Estrutura idêntica'
  };
}

export function compareSchemaMetadata(sourceTables, targetTables) {
  const sourceMap = new Map(sourceTables.map((table) => [normalizeTableName(table), table]));
  const targetMap = new Map(targetTables.map((table) => [normalizeTableName(table), table]));
  const tableNames = new Set([...sourceMap.keys(), ...targetMap.keys()]);

  const onlySource = [];
  const onlyTarget = [];
  const equal = [];
  const different = [];

  for (const key of [...tableNames].sort()) {
    const source = sourceMap.get(key);
    const target = targetMap.get(key);

    if (!source) {
      onlyTarget.push({
        table: target.table,
        schema: target.schema,
        status: 'only_target',
        summary: 'Tabela existe apenas no destino'
      });
      continue;
    }

    if (!target) {
      onlySource.push({
        table: source.table,
        schema: source.schema,
        status: 'only_source',
        summary: 'Tabela existe apenas na origem'
      });
      continue;
    }

    const comparison = compareTableMetadata(source, target);

    if (comparison.status === 'equal') {
      equal.push({
        table: source.table,
        schema: { source: source.schema, target: target.schema },
        status: 'equal',
        summary: comparison.summary
      });
    } else {
      different.push(comparison);
    }
  }

  const totalTables = tableNames.size;
  const hasDifferences = onlySource.length + onlyTarget.length + different.length > 0;

  return {
    status: hasDifferences ? 'different' : 'equal',
    summary: {
      totalTables,
      equal: equal.length,
      different: different.length,
      onlySource: onlySource.length,
      onlyTarget: onlyTarget.length
    },
    equal,
    different,
    onlySource,
    onlyTarget
  };
}
