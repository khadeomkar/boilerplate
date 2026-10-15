
const API_URL = 'https://api.npoint.io/aea8e183fa49cbca071f';
const PAGE_SIZE = 10;

export default async function decorate(block) {
    // Preserve the content authored in EDS.
    const authoredContent = [...block.children];

    const title = authoredContent[0]?.querySelector(
        'h1, h2, h3, h4, h5, h6',
    );
    const description = authoredContent[1];

    // Extract the six individual authored headings, skipping title and description.
    const tableHeaders = authoredContent
        .slice(2)
        .flatMap((row) => [...row.children])
        .map((cell) => cell.textContent.trim())
        .filter(Boolean);

    // Build the disclosure library UI.
    block.innerHTML = `
    <div class="disclosure-library">
      <div class="disclosure-library-header">
        <div class="disclosure-library-title"></div>
        <div class="disclosure-description"></div>
      </div>

      <div class="disclosure-library-actions">
        <div class="disclosure-library-search">
            <label for="disclosure-search">Search disclosures</label>
            <input
            id="disclosure-search"
            type="search"
            placeholder="Search by name, short code, or updated by..."
            />
        </div>

        <div
            class="disclosure-library-filters"
            role="group"
            aria-label="Filter disclosures"
        >
            <button
            type="button"
            class="disclosure-filter-button is-active"
            data-filter="all"
            aria-pressed="true"
            >
            All Disclosures
            </button>

            <button
            type="button"
            class="disclosure-filter-button"
            data-filter="pending"
            aria-pressed="false"
            >
            Pending Requests
            </button>
        </div>
      </div>

      <div class="disclosure-library-table-wrapper">
        <table>
          <thead>
            <tr class="disclosure-table-header"></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="disclosure-pagination"></div>
      <p class="disclosure-library-message" aria-live="polite"></p>
    </div>
  `;

    const titleContainer = block.querySelector('.disclosure-library-title');
    const descriptionContainer = block.querySelector('.disclosure-description');
    const headerRow = block.querySelector('.disclosure-table-header');

    // Insert the authored title.
    if (title && titleContainer) {
        titleContainer.replaceChildren(title.cloneNode(true));
    }

    // Insert the authored description.
    if (description && descriptionContainer) {
        descriptionContainer.innerHTML = description.innerHTML;
    }

    // Generate table headings from EDS authoring.
    tableHeaders.forEach((heading) => {
        const th = document.createElement('th');
        th.textContent = heading;
        th.scope = 'col';
        headerRow.append(th);
    });

    const searchInput = block.querySelector('#disclosure-search');
    const tbody = block.querySelector('tbody');
    const pagination = block.querySelector('.disclosure-pagination');
    const message = block.querySelector('.disclosure-library-message');
    const filterButtons = block.querySelectorAll('.disclosure-filter-button');

    let disclosures = [];
    let filteredDisclosures = [];
    let currentPage = 1;
    let activeFilter = 'all';

    // Apply the selected filter and search query together.
    function applyFilters() {
        const query = searchInput.value.trim().toLowerCase();

        filteredDisclosures = disclosures.filter((item) => {
            const matchesSearch = [
                item.name,
                item.shortCode,
                item.updatedBy,
            ].some((value) =>
                String(value ?? '').toLowerCase().includes(query),
            );

            const hasPendingRequest = Array.isArray(item.editRequests)
                && item.editRequests.some((request) => (
                    String(
                        typeof request === 'string' ? request : request?.status ?? '',
                    ).toLowerCase() === 'pending'
                ));

            const matchesFilter = activeFilter === 'all'
                || (activeFilter === 'pending' && hasPendingRequest);

            return matchesSearch && matchesFilter;
        });

        currentPage = 1;
        renderRows();
    }

    // Switch the active filter button.
    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            activeFilter = button.dataset.filter;

            filterButtons.forEach((filterButton) => {
                const isActive = filterButton === button;

                filterButton.classList.toggle('is-active', isActive);
                filterButton.setAttribute('aria-pressed', String(isActive));
            });

            applyFilters();
        });
    });

    function renderRows() {
        tbody.replaceChildren();
        pagination.replaceChildren();

        const totalRecords = filteredDisclosures.length;
        const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

        currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));

        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = Math.min(startIndex + PAGE_SIZE, totalRecords);

        const paginatedItems = filteredDisclosures.slice(
            startIndex,
            endIndex,
        );

        paginatedItems.forEach((item) => {
            const row = document.createElement('tr');

            // Disclosure Name.
            const nameCell = document.createElement('td');
            nameCell.textContent = item.name ?? '';
            row.append(nameCell);

            // Last Updated.
            const updatedCell = document.createElement('td');
            updatedCell.textContent = item.lastUpdated ?? '';
            row.append(updatedCell);

            // Updated By.
            const updatedByCell = document.createElement('td');
            updatedByCell.textContent = item.updatedBy ?? '';
            row.append(updatedByCell);

            // Times Used.
            const timesUsedCell = document.createElement('td');
            timesUsedCell.textContent = item.timesUsed ?? '';
            row.append(timesUsedCell);

            // Preview.
            const previewCell = document.createElement('td');
            const previewButton = document.createElement('button');

            previewButton.type = 'button';
            previewButton.textContent = 'Preview';

            previewButton.addEventListener('click', () => {
                window.alert(
                    item.content || item.preview || 'No preview available.',
                );
            });

            previewCell.append(previewButton);
            row.append(previewCell);

            // Short Code with copy icon.
            const codeCell = document.createElement('td');
            const codeWrapper = document.createElement('div');
            const code = document.createElement('code');
            const copyButton = document.createElement('button');

            codeWrapper.className = 'disclosure-shortcode-wrapper';
            copyButton.className = 'disclosure-copy-button';
            copyButton.type = 'button';
            copyButton.setAttribute('aria-label', 'Copy short code');
            copyButton.title = 'Copy short code';

            code.textContent = item.shortCode ?? '';

            const copyIcon = `
        <svg xmlns="http://www.w3.org/2000/svg"
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true">
          <rect x="8" y="8" width="13" height="13" rx="2"/>
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
        </svg>
      `;

            const copiedIcon = `
        <svg xmlns="http://www.w3.org/2000/svg"
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true">
          <path d="m5 12 4 4L19 6"/>
        </svg>
      `;

            copyButton.innerHTML = copyIcon;

            copyButton.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(item.shortCode ?? '');

                    copyButton.innerHTML = copiedIcon;
                    copyButton.setAttribute('aria-label', 'Copied');
                    copyButton.title = 'Copied!';

                    window.setTimeout(() => {
                        copyButton.innerHTML = copyIcon;
                        copyButton.setAttribute('aria-label', 'Copy short code');
                        copyButton.title = 'Copy short code';
                    }, 1500);
                } catch {
                    message.textContent =
                        'Copy failed. Please copy the short code manually.';
                }
            });

            codeWrapper.append(code, copyButton);
            codeCell.append(codeWrapper);
            row.append(codeCell);

            tbody.append(row);
        });

        // Record count.
        const recordCount = document.createElement('p');
        recordCount.className = 'disclosure-record-count';
        recordCount.textContent =
            `Showing ${totalRecords ? startIndex + 1 : 0}-${endIndex} of ${totalRecords} records`;

        pagination.append(recordCount);

        // Pagination controls.
        const controls = document.createElement('div');
        controls.className = 'disclosure-pagination-controls';
        pagination.append(controls);

        function createButton(label, page, disabled = false, active = false) {
            const button = document.createElement('button');

            button.type = 'button';
            button.textContent = label;
            button.disabled = disabled;

            if (active) {
                button.classList.add('is-active');
                button.setAttribute('aria-current', 'page');
            }

            button.addEventListener('click', () => {
                currentPage = page;
                renderRows();
            });

            return button;
        }

        if (totalPages > 1) {
            controls.append(
                createButton('Previous', currentPage - 1, currentPage === 1),
            );

            for (let page = 1; page <= totalPages; page += 1) {
                controls.append(
                    createButton(
                        String(page),
                        page,
                        false,
                        page === currentPage,
                    ),
                );
            }

            controls.append(
                createButton('Next', currentPage + 1, currentPage === totalPages),
            );
        }

        message.textContent = totalRecords ? '' : 'No disclosures found.';
    }

    try {
        message.textContent = 'Loading disclosures...';

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        disclosures = Array.isArray(data)
            ? data
            : data.disclosures || [];

        applyFilters();
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Unable to load disclosures:', error);

        message.textContent =
            'Unable to load disclosures. Please check the API or network connection.';
    }

    // Search within the currently selected filter.
    searchInput.addEventListener('input', applyFilters);
}
