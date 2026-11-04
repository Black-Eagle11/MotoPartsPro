
function buildPageItems(currentPage, lastPage, siblingCount = 1) {
  const pages = new Set([1, lastPage]);

  for (
    let page = Math.max(1, currentPage - siblingCount);
    page <= Math.min(lastPage, currentPage + siblingCount);
    page += 1
  ) {
    pages.add(page);
  }

  const sortedPages = [...pages].sort((a, b) => a - b);
  const result = [];

  for (let index = 0; index < sortedPages.length; index += 1) {
    const page = sortedPages[index];
    const previousPage = sortedPages[index - 1];

    if (index > 0 && page - previousPage > 1) {
      result.push({
        type: "ellipsis",
        key: `ellipsis-${previousPage}-${page}`,
      });
    }

    result.push({
      type: "page",
      page,
      key: `page-${page}`,
    });
  }

  return result;
}

export default function Pagination({
  meta,
  onPageChange,
  isLoading = false,
  disabled = false,
  siblingCount = 1,
  label = "Navigasi halaman",
}) {
  if (
    !meta ||
    typeof onPageChange !== "function"
  ) {
    return null;
  }

  const currentPage = Number(meta.current_page ?? 1);
  const lastPage = Number(meta.last_page ?? 1);
  const total = Number(meta.total ?? 0);
  const from = meta.from ?? 0;
  const to = meta.to ?? 0;

  if (
    !Number.isInteger(currentPage) ||
    !Number.isInteger(lastPage) ||
    currentPage < 1 ||
    lastPage < 1 ||
    currentPage > lastPage
  ) {
    return null;
  }

  const interactionDisabled = disabled || isLoading;
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < lastPage;

  const pageItems = buildPageItems(
    currentPage,
    lastPage,
    Math.max(0, siblingCount),
  );

  function changePage(page) {
    if (
      interactionDisabled ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > lastPage ||
      page === currentPage
    ) {
      return;
    }

    onPageChange(page);
  }

  return (
    <nav
      className="pagination"
      aria-label={label}
    >
      <p
        className="pagination-info"
        aria-live="polite"
      >
        {total === 0
          ? "Tidak ada data"
          : `Menampilkan ${from}–${to} dari ${total} data`}
      </p>

      {lastPage > 1 && (
        <div className="pagination-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => changePage(currentPage - 1)}
            disabled={interactionDisabled || !canGoPrevious}
            aria-label="Halaman sebelumnya"
          >
            Sebelumnya
          </button>

          {pageItems.map((item) =>
            item.type === "ellipsis" ? (
              <span
                key={item.key}
                className="pagination-info"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item.key}
                type="button"
                className={
                  item.page === currentPage
                    ? "btn btn-primary"
                    : "btn btn-secondary"
                }
                onClick={() => changePage(item.page)}
                disabled={interactionDisabled}
                aria-label={`Halaman ${item.page}`}
                aria-current={
                  item.page === currentPage
                    ? "page"
                    : undefined
                }
              >
                {item.page}
              </button>
            ),
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => changePage(currentPage + 1)}
            disabled={interactionDisabled || !canGoNext}
            aria-label="Halaman berikutnya"
          >
            Berikutnya
          </button>
        </div>
      )}
    </nav>
  );
}
