const API_URL = 'https://api.npoint.io/5665eb6d83150e73c4cf';
const PAGE_SIZE = 10;

export default async function decorate(block) {
    // Preserve content authored in EDS.
    const authoredContent = [...block.children];

    const title = authoredContent[0]?.querySelector(
        'h1, h2, h3, h4, h5, h6',
    );
    const description = authoredContent[1];

    // Extract the six authorable table headings.
    const tableHeaders = authoredContent
        .slice(2)
        .flatMap((row) => [...row.children])
        .map((cell) => cell.textContent.trim())
        .filter(Boolean);

    // Build the Disclosure Library UI.
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
      <dialog class="disclosure-preview-modal" aria-labelledby="disclosure-modal-title">
        <div class="disclosure-preview-modal-header">
            <h2 id="disclosure-modal-title">Disclosure Preview</h2>
            <button
            type="button"
            class="disclosure-modal-close"
            aria-label="Close preview"
            >
            &times;
            </button>
        </div>

        <div class="disclosure-preview-modal-content"></div>
      </dialog>
    </div>
  `;

    const titleContainer = block.querySelector('.disclosure-library-title');
    const descriptionContainer = block.querySelector('.disclosure-description');
    const headerRow = block.querySelector('.disclosure-table-header');
    const previewModal = block.querySelector('.disclosure-preview-modal');
    const previewModalContent = block.querySelector(
        '.disclosure-preview-modal-content',
    );
    const closeModalButton = block.querySelector('.disclosure-modal-close');

    // Render the authored title.
    if (title && titleContainer) {
        titleContainer.replaceChildren(title.cloneNode(true));
    }

    // Render the authored description.
    if (description && descriptionContainer) {
        descriptionContainer.innerHTML = description.innerHTML;
    }

    // Render authorable column headings.
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

    // Read a named value from AEM stringMetadata.
    function getMetadataValue(item, metadataName) {
        const metadata = item?._metadata?.stringMetadata;

        if (!Array.isArray(metadata)) {
            return '';
        }

        const entry = metadata.find(
            (field) => field.name === metadataName,
        );

        return entry?.value ?? '';
    }

    // Read a named value from AEM calendarMetadata.
    function getCalendarValue(item, metadataName) {
        const metadata = item?._metadata?.calendarMetadata;

        if (!Array.isArray(metadata)) {
            return '';
        }

        const entry = metadata.find(
            (field) => field.name === metadataName,
        );

        return entry?.value ?? '';
    }

    // Convert the AEM GraphQL record into the UI data structure.
    function normalizeDisclosure(item) {
        return {
            name: getMetadataValue(item, 'disc.disclaimerName'),
            updatedBy: getMetadataValue(item, 'disc.owner'),
            description: getMetadataValue(item, 'disc.description'),
            shortCode: getMetadataValue(item, 'disc.disclaimerId'),

            // AEM stores the last-modified date in calendarMetadata.
            lastUpdated: getCalendarValue(item, 'cq:lastModified'),

            // These fields are not present in the supplied API response.
            timesUsed: item.timesUsed ?? '',
            editRequests: Array.isArray(item.editRequests)
                ? item.editRequests
                : [],

            // Use approved content when available for the preview.
            preview:
                item.approvedCopy?.plaintext
                || getMetadataValue(item, 'disc.description'),
        };
    }

    // Apply search and the selected filter together.
    function applyFilters() {
        const query = searchInput.value.trim().toLowerCase();

        filteredDisclosures = disclosures.filter((item) => {
            const matchesSearch = [
                item.name,
                item.shortCode,
                item.updatedBy,
                item.description,
            ].some((value) =>
                String(value ?? '').toLowerCase().includes(query),
            );

            const hasPendingRequest = item.editRequests.some((request) => (
                String(
                    typeof request === 'string'
                        ? request
                        : request?.status ?? '',
                ).toLowerCase() === 'pending'
            ));

            const matchesFilter = activeFilter === 'all'
                || (activeFilter === 'pending' && hasPendingRequest);

            return matchesSearch && matchesFilter;
        });

        currentPage = 1;
        renderRows();
    }

    // Filter buttons.
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
            nameCell.textContent = item.name;
            row.append(nameCell);

            // Last Updated.
            const updatedCell = document.createElement('td');
            updatedCell.textContent = item.lastUpdated
                ? new Date(item.lastUpdated).toLocaleDateString('en-GB')
                : '';
            row.append(updatedCell);

            // Updated By.
            const updatedByCell = document.createElement('td');
            updatedByCell.textContent = item.updatedBy;
            row.append(updatedByCell);

            // Times Used.
            const timesUsedCell = document.createElement('td');
            timesUsedCell.textContent = item.timesUsed;
            row.append(timesUsedCell);

            // Preview.
            const previewCell = document.createElement('td');
            const previewButton = document.createElement('button');

            previewButton.type = 'button';
            previewButton.textContent = 'Preview';

            previewButton.addEventListener('click', () => {
                previewModalContent.textContent =
                    item.preview || 'No preview available.';

                previewModal.showModal();
            });

            previewCell.append(previewButton);
            row.append(previewCell);

            // Short Code and copy button.
            const codeCell = document.createElement('td');
            const codeWrapper = document.createElement('div');
            const code = document.createElement('code');
            const copyButton = document.createElement('button');

            codeWrapper.className = 'disclosure-shortcode-wrapper';
            copyButton.className = 'disclosure-copy-button';
            copyButton.type = 'button';
            copyButton.setAttribute('aria-label', 'Copy short code');
            copyButton.title = 'Copy short code';

            code.textContent = item.shortCode;

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
                    await navigator.clipboard.writeText(item.shortCode);

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

    // Fetch and render AEM GraphQL data.
    try {
        message.textContent = 'Loading disclosures...';

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        // Exact path verified from the supplied API:
        // data.data.disclaimerHubList.items
        const items = data?.data?.disclaimerHubList?.items;

        if (!Array.isArray(items)) {
            throw new Error(
                'Unexpected API response: data.disclaimerHubList.items is missing.',
            );
        }

        disclosures = items.map(normalizeDisclosure);

        applyFilters();
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Unable to load disclosures:', error);

        message.textContent =
            'Unable to load disclosures. Check the API response and network connection.';
    }

    // Close the modal using the close button.
    closeModalButton.addEventListener('click', () => {
        previewModal.close();
    });

    // Close when clicking the backdrop outside the modal content.
    previewModal.addEventListener('click', (event) => {
        if (event.target === previewModal) {
            previewModal.close();
        }
    });

    // Search disclosures.
    searchInput.addEventListener('input', applyFilters);
}
