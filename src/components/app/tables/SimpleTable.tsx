type Column<Row> = {
  key: string;
  header: string;
  render: (row: Row) => string;
};

type SimpleTableProps<Row> = {
  columns: Array<Column<Row>>;
  rows: Row[];
  getRowKey?: (row: Row, index: number) => string;
};

export function SimpleTable<Row>({
  columns,
  rows,
  getRowKey,
}: SimpleTableProps<Row>) {
  return (
    <div className="overflow-x-auto rounded-[24px] border border-border bg-background/70">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-border bg-card/60">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={getRowKey ? getRowKey(row, idx) : String(idx)}
              className="border-b border-border/60 last:border-0"
            >
              {columns.map((column) => (
                <td key={column.key} className="px-5 py-4 text-sm">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
