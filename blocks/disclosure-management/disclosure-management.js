
const API_URL = 'https://api.npoint.io/5665eb6d83150e73c4cf';
const PAGE_SIZE = 10;

export default async function decorate(block) {
    // Preserve content authored in EDS.
    const authoredContent = [...block.children];

    const title = authoredContent[0]?.querySelector(
        'h1, h2, h3, h4, h5, h6',
    );
    const description = authoredContent[1];

    // Default values for authorable settings.
    const defaultSettings = {
        'search title': 'Search disclosures',
        'search placeholder': 'Search by name, short code, or updated by',
        'preview button text': 'preview',
    };

    const authorableSettings = { ...defaultSettings };
    const settingNames = new Set(Object.keys(defaultSettings));

    // Read settings from two-cell rows:
    // First cell = setting name; second cell = setting value.
    const contentRows = authoredContent.slice(2);
    const tableHeaderCells = [];

    contentRows.forEach((row) => {
        const cells = [...row.children];
        const settingName = cells[0]?.textContent.trim().toLowerCase();

        if (cells.length >= 2 && settingNames.has(settingName)) {
            const value = cells[1].textContent.trim();

            if (value) {
                authorableSettings[settingName] = value;
            }

            return;
        }

        // Keep all non-settings cells as authorable table headings.
        tableHeaderCells.push(...cells);
    });

    const tableHeaders = tableHeaderCells
        .map((cell) => cell.textContent.trim())
        .filter(Boolean);

    // Build the Disclosure Library UI.
    block.innerHTML = `
      <section id="page-disclosure" class="disclosure-library">
        <div class="page-header">
          <div class="eyebrow">Disclosure Management</div>
        </div>

        <div class="toolbar">
          <div class="toolbar-search">
            <label for="disclosure-search"></label>
            <input
              id="disclosure-search"
              type="search"
              placeholder=""
            />
          </div>
          
          <div class="toolbar-filters">
            <select id="product-line-filter" class="disclosure-filter-select">
              <option value="">All Product Lines</option>
              <option value="">Commercial</option>
              <option value="">Dental</option>
              <option value="">Vision</option>
            </select>
          </div>
          
          <button type="button" class="disclosure-new-button">+ New Disclosure</button>
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

        <p
          class="disclosure-library-message"
          aria-live="polite"
        ></p>

        <dialog
          class="disclosure-preview-modal"
          aria-labelledby="disclosure-modal-title"
        >
          <div class="disclosure-preview-modal-header">
            <div class="disclosure-preview-modal-heading">
                <h2 id="disclosure-modal-title">Disclosure Preview</h2>
                <p class="disclosure-preview-updated"></p>
            </div>

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
      </section>
    `;

    const pageHeader = block.querySelector('.page-header');
    const headerRow = block.querySelector('.disclosure-table-header');
    const previewModal = block.querySelector('.disclosure-preview-modal');
    const previewModalTitle = block.querySelector('#disclosure-modal-title');
    const previewModalUpdated = block.querySelector(
        '.disclosure-preview-updated',
    );
    const previewModalContent = block.querySelector(
        '.disclosure-preview-modal-content',
    );
    const closeModalButton = block.querySelector('.disclosure-modal-close');

    // Extract page name from URL and display it under eyebrow
    const pathname = window.location.pathname;
    const pageName = pathname.split('/').filter(Boolean).pop() || '';
    const formattedPageName = pageName.replace(/-/g, ' ').toUpperCase();
    console.log({ formattedPageName });
    if (formattedPageName && pageHeader) {
        const pageTitle = document.createElement('h1');
        pageTitle.textContent = formattedPageName;
        pageHeader.append(pageTitle);
    }

    // Render the authored page title and description in page-header.
    if (title && pageHeader) {
        pageHeader.append(title.cloneNode(true));
    }

    if (description && pageHeader) {
        const descParagraph = document.createElement('p');
        descParagraph.innerHTML = description.innerHTML;
        pageHeader.append(descParagraph);
    }

    // Render the authorable table headings.
    tableHeaders.forEach((heading) => {
        const th = document.createElement('th');
        th.textContent = heading;
        th.scope = 'col';
        headerRow.append(th);
    });

    const searchInput = block.querySelector('#disclosure-search');
    const searchLabel = block.querySelector(
        'label[for="disclosure-search"]',
    );
    const tbody = block.querySelector('tbody');
    const pagination = block.querySelector('.disclosure-pagination');
    const message = block.querySelector('.disclosure-library-message');

    // Apply the EDS-authored search settings.
    searchLabel.textContent = authorableSettings['search title'];
    searchInput.placeholder = authorableSettings['search placeholder'];

    let disclosures = [];
    let filteredDisclosures = [];
    let currentPage = 1;

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

    // Convert an AEM GraphQL record into the UI data structure.
    function normalizeDisclosure(item) {
        return {
            name: getMetadataValue(item, 'disc.disclaimerName'),
            updatedBy: getMetadataValue(item, 'disc.owner'),
            description: getMetadataValue(item, 'disc.description'),
            shortCode: getMetadataValue(item, 'disc.disclaimerId'),

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
            return [
                item.name,
                item.shortCode,
                item.updatedBy,
                item.description,
            ].some((value) =>
                String(value ?? '').toLowerCase().includes(query),
            );
        });

        currentPage = 1;
        renderRows();
    }

    function renderRows() {
        tbody.replaceChildren();
        pagination.replaceChildren();

        const totalRecords = filteredDisclosures.length;
        const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

        currentPage = Math.max(
            1,
            Math.min(currentPage, totalPages || 1),
        );

        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = Math.min(
            startIndex + PAGE_SIZE,
            totalRecords,
        );

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

            // Preview button opens the modal.
            const previewCell = document.createElement('td');
            const previewButton = document.createElement('button');

            previewButton.type = 'button';
            previewButton.className = 'disclosure-preview-button';
            
            // Add eye icon before text
            const eyeIcon = `
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
            `;
            
            previewButton.innerHTML = eyeIcon + `<span>${authorableSettings['preview button text']}</span>`;

            previewButton.addEventListener('click', () => {
                // Display the actual disclosure name as the modal title.
                previewModalTitle.textContent = item.name || 'Disclosure Preview';

                // Clear previous preview content.
                previewModalContent.replaceChildren();

                // Format the last-updated date.
                const updatedDate = item.lastUpdated
                    ? new Date(item.lastUpdated).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                    })
                    : '';

                // Display last-updated information.
                previewModalUpdated.textContent = [
                    'Last updated',
                    updatedDate,
                    item.updatedBy ? `by ${item.updatedBy}` : '',
                ].filter(Boolean).join(' ');

                // Disclosure Text label.
                const disclosureLabel = document.createElement('h3');
                disclosureLabel.textContent = 'Disclosure Text';
                previewModalContent.append(disclosureLabel);

                // Disclosure description/content.
                const disclosureText = document.createElement('p');
                disclosureText.className = 'disclosure-preview-text';
                disclosureText.textContent = item.preview || item.description || '';
                previewModalContent.append(disclosureText);

                // Short Code label.
                const shortCodeLabel = document.createElement('h3');
                shortCodeLabel.textContent = 'Short Code';
                previewModalContent.append(shortCodeLabel);

                // Short Code value.
                const shortCodeValue = document.createElement('p');
                shortCodeValue.className = 'disclosure-preview-shortcode';
                shortCodeValue.textContent = item.shortCode || '';
                previewModalContent.append(shortCodeValue);

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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="8" y="8" width="13" height="13" rx="2"/>
                  <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
                </svg>
            `;

            const copiedIcon = `
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
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
                        copyButton.setAttribute(
                            'aria-label',
                            'Copy short code',
                        );
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

        function createButton(
            label,
            page,
            disabled = false,
            active = false,
        ) {
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
                createButton(
                    'Previous',
                    currentPage - 1,
                    currentPage === 1,
                ),
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
                createButton(
                    'Next',
                    currentPage + 1,
                    currentPage === totalPages,
                ),
            );
        }

        message.textContent = totalRecords
            ? ''
            : 'No disclosures found.';
    }

    // Close the preview modal using the close button.
    closeModalButton.addEventListener('click', () => {
        previewModal.close();
    });

    // Close the modal when clicking its backdrop.
    previewModal.addEventListener('click', (event) => {
        if (event.target === previewModal) {
            previewModal.close();
        }
    });

    // Search disclosures.
    searchInput.addEventListener('input', applyFilters);

    // Fetch and render AEM GraphQL data.
    try {
        message.textContent = 'Loading disclosures...';

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

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
}
