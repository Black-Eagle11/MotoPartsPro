
function displayCellValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "Ya" : "Tidak";
  }

  if (value instanceof Date) {
    return value.toLocaleString("id-ID");
  }

  return JSON.stringify(value);
}

export default function DataTable({
  columns = [],
  data = [],
  rowKey = "id",
  isLoading = false,
  error = null,
  emptyMessage = "Belum ada data yang tersedia.",
  loadingMessage = "Memuat data...",
  caption = "Data MotoPartsPro",
  actions = null,
  getRowLabel = null,
}) {
  const getKey = (row, index) => {
    const value =
      typeof rowKey === "function"
        ? rowKey(row, index)
        : row?.[rowKey];

    return value ?? `row-${index}`;
  };

  return (
    <div className="table-container">
      <table>
        <caption className="sr-only">{caption}</caption>

        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.headerClassName ?? ""}
              >
                {column.label}
              </th>
            ))}

            {actions && (
              <th scope="col">Aksi</th>
            )}
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            <tr>
              <td
                colSpan={Math.max(
                  1,
                  columns.length + (actions ? 1 : 0),
                )}
              >
                <div
                  className="loading-state"
                  role="status"
                  aria-live="polite"
                >
                  {loadingMessage}
                </div>
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td
                colSpan={Math.max(
                  1,
                  columns.length + (actions ? 1 : 0),
                )}
              >
                <div
                  className="alert alert-error"
                  role="alert"
                >
                  {typeof error === "string"
                    ? error
                    : "Terjadi kesalahan saat memuat data."}
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(
                  1,
                  columns.length + (actions ? 1 : 0),
                )}
              >
                <div className="empty-state">
                  {emptyMessage}
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={getKey(row, rowIndex)}>
                {columns.map((column) => {
                  const value = row?.[column.key];

                  return (
                    <td
                      key={column.key}
                      className={column.className ?? ""}
                    >
                      {typeof column.render === "function"
                        ? column.render(value, row, rowIndex)
                        : displayCellValue(value)}
                    </td>
                  );
                })}

                {actions && (
                  <td>
                    {typeof actions === "function"
                      ? actions(row, rowIndex)
                      : actions}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
