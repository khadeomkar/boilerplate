const API_BASE_URL = 'https://publish-p233649-e2378578.adobeaemcloud.com/graphql/execute.json/merkle-highmark/disclaimers';
const API_BASE_URL_WITH_STATE = 'https://publish-p233649-e2378578.adobeaemcloud.com/graphql/execute.json/merkle-highmark/disclaimers-withstate';
const LOB_API_URL = 'https://publish-p233649-e2378578.adobeaemcloud.com/graphql/execute.json/merkle-highmark/lob';
const STATE_REGIONS_API_URL = 'https://publish-p233649-e2378578.adobeaemcloud.com/graphql/execute.json/merkle-highmark/state-regions';
const INITIAL_API_LIMIT = 101; // Fetch 101 records on first call to check if more exist
const SUBSEQUENT_API_LIMIT = 100; // Fetch 100 records on subsequent calls
const PAGE_SIZE = 10; // Display 10 items per page
const maxVisiblePages = 5;

export default async function decorate(block) {
    // Preserve content authored in EDS.
    const authoredContent = [...block.children];

    const title = authoredContent[0]?.querySelector(
        'h1, h2, h3, h4, h5, h6',
    );
    const description = authoredContent[1];

    // Default values for authorable settings.
    const defaultSettings = {
        'search title': 'Search disclaimers',
        'search placeholder': 'Search by name, short code, or updated by',
        'preview button text': 'preview',
        'no results': 'No disclaimers found.',
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

    // Build the disclaimer Library UI.
    block.innerHTML = `
      <section id="page-disclaimer" class="disclaimer-library">
        <div class="page-header">
          <div class="eyebrow">Disclaimer Management</div>
        </div>

        <div class="toolbar">
          <div class="toolbar-search">
            <label for="disclaimer-search"></label>
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
              <path d="M16.9,15.5c2.4-3.2,2.2-7.7-0.7-10.6c-3.1-3.1-8.1-3.1-11.3,0c-3.1,3.2-3.1,8.3,0,11.4
                c2.9,2.9,7.5,3.1,10.6,0.6c0,0.1,0,0.1,0,0.1l4.2,4.2c0.5,0.4,1.1,0.4,1.5,0c0.4-0.4,0.4-1,0-1.4L16.9,15.5
                C16.9,15.5,16.9,15.5,16.9,15.5L16.9,15.5z M14.8,6.3c2.3,2.3,2.3,6.1,0,8.5c-2.3,2.3-6.1,2.3-8.5,0C4,12.5,4,8.7,6.3,6.3
                C8.7,4,12.5,4,14.8,6.3z"/>
            </svg>
            <input
              id="disclaimer-search"
              type="search"
              placeholder=""
            />
            <button
              type="button"
              class="search-close"
              aria-label="Clear search"
            >
              &times;
            </button>
          </div>
          
          <div class="toolbar-filters">
            <select id="product-line-filter" class="disclaimer-filter-select">
              <option value="">Line of Business</option>
            </select>
          </div>
          
          <button type="button" class="disclaimer-new-button btn-primary">+ New disclaimer</button>
        </div>

        <div class="more-filters-toggle">
          <button type="button" class="more-filters-button" aria-expanded="false">
            More Filters
            <svg class="chevron-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>

        <div class="more-filters-section" hidden>
          <div class="more-filters-grid">
            <div class="filter-group">
              <label for="state-filter">State</label>
              <select id="state-filter" class="disclaimer-filter-select">
                <option value="">Select State</option>
              </select>
            </div>

            <div class="filter-group">
              <label for="region-filter">Region</label>
              <select id="region-filter" class="disclaimer-filter-select">
                <option value="">Select Region</option>
              </select>
            </div>

            <div class="filter-group">
              <label>Audience</label>
              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" name="audience" value="prospect" />
                  <span>Prospect</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" name="audience" value="member" />
                  <span>Member</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" name="audience" value="provider" />
                  <span>Provider</span>
                </label>
              </div>
            </div>

            <div class="filter-actions">
              <button type="button" class="filter-apply-button btn-primary">Apply</button>
              <button type="button" class="filter-clear-button btn-secondary">Clear</button>
            </div>
          </div>
        </div>

        <div class="disclaimer-library-table-wrapper">
          <table>
            <thead>
              <tr class="disclaimer-table-header"></tr>
            </thead>
            <tbody></tbody>
          </table>
          <div class="loader-container" hidden>
            <svg class="loader-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
              <circle class="loader-path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
            </svg>
          </div>
        </div>

        <div class="disclaimer-pagination"></div>

        <p
          class="disclaimer-library-message"
          aria-live="polite"
        ></p>

        <dialog
          class="modal"
          aria-labelledby="modal-title"
        >
          <div class="modal-head">
            <div class="modal-heading">
                <h3 id="modal-title">disclaimer Preview</h3>
                <p class="disclaimer-preview-updated"></p>
            </div>

            <button
              type="button"
              class="disclaimer-modal-close"
              aria-label="Close preview"
            >
              &times;
            </button>
          </div>

          <div class="modal-body"></div>
        </dialog>
      </section>
    `;

    const pageHeader = block.querySelector('.page-header');
    const headerRow = block.querySelector('.disclaimer-table-header');
    const previewModal = block.querySelector('.modal');
    const previewModalTitle = block.querySelector('#modal-title');
    const previewModalUpdated = block.querySelector(
        '.disclaimer-preview-updated',
    );
    const previewModalContent = block.querySelector(
        '.modal-body',
    );
    const closeModalButton = block.querySelector('.disclaimer-modal-close');

    // Extract page name from URL and display it in eyebrow div
    const pathname = window.location.pathname;
    const pageName = pathname.split('/').filter(Boolean).pop() || '';
    const formattedPageName = pageName.replace(/-/g, ' ').toUpperCase();

    const eyebrowDiv = block.querySelector('.eyebrow');
    if (formattedPageName && eyebrowDiv) {
        eyebrowDiv.textContent = formattedPageName;
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

    const searchInput = block.querySelector('#disclaimer-search');
    const searchLabel = block.querySelector(
        'label[for="disclaimer-search"]',
    );
    const searchCloseButton = block.querySelector('.search-close');
    const productLineFilter = block.querySelector('#product-line-filter');
    const stateFilter = block.querySelector('#state-filter');
    const regionFilter = block.querySelector('#region-filter');
    const audienceCheckboxes = block.querySelectorAll('input[name="audience"]');
    const applyFiltersButton = block.querySelector('.filter-apply-button');
    const clearFiltersButton = block.querySelector('.filter-clear-button');
    const tbody = block.querySelector('tbody');
    const pagination = block.querySelector('.disclaimer-pagination');
    const message = block.querySelector('.disclaimer-library-message');
    const loaderContainer = block.querySelector('.loader-container');

    // Apply the EDS-authored search settings.
    searchLabel.textContent = authorableSettings['search title'];
    searchInput.placeholder = authorableSettings['search placeholder'];

    // Toggle search close button visibility
    function toggleSearchCloseButton() {
        if (searchInput.value.trim()) {
            searchCloseButton.classList.add('visible');
        } else {
            searchCloseButton.classList.remove('visible');
        }
    }

    // Clear search input when close button is clicked
    searchCloseButton.addEventListener('click', () => {
        searchInput.value = '';
        toggleSearchCloseButton();
        currentPage = 1;
        fetchDisclaimers(currentPage);
        searchInput.focus();
    });

    // Show/hide close button as user types
    searchInput.addEventListener('input', () => {
        toggleSearchCloseButton();
    });

    let disclaimers = [];
    let filteredDisclaimers = [];
    let currentPage = 1;
    let currentOffset = 0;
    let hasMoreRecords = false;
    let isInitialLoad = true;

    // Function to build API URL with dynamic parameters
    function buildApiUrl(offset = 0, limit = INITIAL_API_LIMIT) {
        const params = [];
        
        // Check if state filter is selected to determine which endpoint to use
        const stateValue = stateFilter.value;
        const regionValue = regionFilter.value;
        const hasStateFilter = stateValue && stateValue.trim() !== '';
        
        // Choose the appropriate base URL
        const baseUrl = hasStateFilter ? API_BASE_URL_WITH_STATE : API_BASE_URL;
        
        // Use dynamic offset and limit
        params.push(`offset=${offset}`);
        params.push(`limit=${limit}`);
        
        // Add state and region parameters when state filter is selected
        if (hasStateFilter) {
            // region parameter: merkle:usa/{state}/{region or "all"}
            const regionParam = regionValue && regionValue.trim() !== '' 
                ? `merkle:usa/${stateValue}/${regionValue}`
                : `merkle:usa/${stateValue}/all`;
            params.push(`region=${regionParam}`);
            
            // state parameter: merkle:usa/{state}
            params.push(`state=merkle:usa/${stateValue}`);
            
            // stateAll parameter: merkle:usa/{state}/all
            params.push(`stateAll=merkle:usa/${stateValue}/all`);
        }
        
        // Add LOB parameter only if a value is selected (not placeholder)
        const lob = productLineFilter.value;
        if (lob) {
            params.push(`lob=${lob}`);
        }
        
        // Add search parameter if search query exists
        const searchQuery = searchInput.value.trim();
        if (searchQuery) {
            params.push(`search=${searchQuery}`);
        }
        
        // Add audience filter as individual parameters (e.g., memberAudience=true)
        const selectedAudiences = Array.from(audienceCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        selectedAudiences.forEach(audience => {
            params.push(`${audience}Audience=true`);
        });
        
        // Join parameters with semicolon and encode
        const paramString = params.join(';');
        const encodedParams = encodeURIComponent(paramString);
        
        return `${baseUrl}%3B${encodedParams}`;
    }

    // Convert an AEM GraphQL record into the UI data structure.
    function dormalizeDisclaimer(item) {
        return {
            name: item.disclaimerName || '',
            updatedBy: item.owner || '',
            description: item.approvedCopy || '',
            shortCode: item.disclaimerId || '',

            lastUpdated: item.lastModified || '',

            // These fields are not present in the supplied API response.
            timesUsed: item.timesUsed ?? '',
            editRequests: Array.isArray(item.editRequests)
                ? item.editRequests
                : [],

            // Preserve approvedCopy object structure for preview
            approvedCopy: item.approvedCopy || {},
            
            // Use approved content when available for the preview.
            preview: item.approvedCopy || '',
        };
    }

    // Render data - all filtering is done server-side, pagination is client-side
    function renderData(resetPage = true) {
        filteredDisclaimers = disclaimers;
        if (resetPage) {
            currentPage = 1; // Reset to first page when data changes
        }
        renderRows();
    }

    function renderRows() {
        tbody.replaceChildren();
        pagination.replaceChildren();

        // Use client-side pagination with all fetched disclaimers
        const totalPages = Math.ceil(filteredDisclaimers.length / PAGE_SIZE);

        currentPage = Math.max(
            1,
            Math.min(currentPage, totalPages || 1),
        );

        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = Math.min(
            startIndex + PAGE_SIZE,
            filteredDisclaimers.length,
        );

        // Get only the disclaimers for the current page
        const pageDisclaimers = filteredDisclaimers.slice(startIndex, endIndex);

        // Create a mapping of column headers to their rendering functions
        const columnRenderers = {
            'name': (item) => {
                const cell = document.createElement('td');
                cell.textContent = item.name;
                return cell;
            },
            'disclaimer name': (item) => {
                const cell = document.createElement('td');
                cell.textContent = item.name;
                return cell;
            },
            'last updated': (item) => {
                const cell = document.createElement('td');
                cell.textContent = item.lastUpdated
                    ? new Date(item.lastUpdated).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                    })
                    : '';
                return cell;
            },
            'updated by': (item) => {
                const cell = document.createElement('td');
                cell.textContent = item.updatedBy;
                return cell;
            },
            'times used': (item) => {
                const cell = document.createElement('td');
                cell.textContent = item.timesUsed;
                return cell;
            },
            'preview': (item) => {
                const cell = document.createElement('td');
                const previewButton = document.createElement('button');

                previewButton.type = 'button';
                previewButton.className = 'disclaimer-preview-button';

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
                    previewModalTitle.textContent = item.name || 'disclaimer Preview';
                    previewModalContent.replaceChildren();

                    const updatedDate = item.lastUpdated
                        ? new Date(item.lastUpdated).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                        })
                        : '';

                    previewModalUpdated.textContent = [
                        'Last updated',
                        updatedDate,
                        item.updatedBy ? `by ${item.updatedBy}` : '',
                    ].filter(Boolean).join(' ');

                    const disclaimerLabel = document.createElement('h4');
                    disclaimerLabel.textContent = 'Disclaimer Text';
                    previewModalContent.append(disclaimerLabel);

                    const disclaimerText = document.createElement('div');
                    disclaimerText.className = 'disclaimer-preview-text';
                    disclaimerText.innerHTML = item.approvedCopy?.html || item.preview || item.description || '';
                    previewModalContent.append(disclaimerText);

                    const shortCodeLabel = document.createElement('h4');
                    shortCodeLabel.textContent = 'Short Code';
                    previewModalContent.append(shortCodeLabel);

                    const shortCodeValue = document.createElement('p');
                    shortCodeValue.className = 'disclaimer-preview-shortcode';
                    shortCodeValue.textContent = item.shortCode || '';
                    previewModalContent.append(shortCodeValue);

                    previewModal.showModal();
                });

                cell.append(previewButton);
                return cell;
            },
            'short code': (item) => {
                const cell = document.createElement('td');
                const codeWrapper = document.createElement('div');
                const code = document.createElement('code');
                const copyButton = document.createElement('button');

                codeWrapper.className = 'disclaimer-shortcode-wrapper';
                copyButton.className = 'disclaimer-copy-button';
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
                cell.append(codeWrapper);
                return cell;
            },
        };

        pageDisclaimers.forEach((item) => {
            const row = document.createElement('tr');

            // Only render cells for columns that have headers defined in authoring
            tableHeaders.forEach((header) => {
                const headerKey = header.toLowerCase().trim();
                const renderer = columnRenderers[headerKey];

                if (renderer) {
                    row.append(renderer(item));
                } else {
                    // If no specific renderer exists, create empty cell
                    const cell = document.createElement('td');
                    row.append(cell);
                }
            });

            tbody.append(row);
        });

        // Record count.
        const recordCount = document.createElement('p');
        recordCount.className = 'disclaimer-record-count';
        // When hasMoreRecords is true, display count as multiples of 100 with "+"
        // e.g., 101 records → "100+", 201 records → "200+"
        const totalCount = hasMoreRecords 
            ? `${Math.floor(filteredDisclaimers.length / 100) * 100}+` 
            : filteredDisclaimers.length;
        recordCount.textContent =
            `Showing ${filteredDisclaimers.length ? startIndex + 1 : 0}-${endIndex} of ${totalCount} records`;

        pagination.append(recordCount);

        // Pagination controls.
        const controls = document.createElement('div');
        controls.className = 'disclaimer-pagination-controls';
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

            button.addEventListener('click', async () => {
                const totalPages = Math.ceil(filteredDisclaimers.length / PAGE_SIZE);
                
                // Check if clicking on the last page and we might have more records
                if (page === totalPages && hasMoreRecords) {
                    // Need to fetch more data
                    // Use current disclaimers length as the offset to avoid duplicates
                    currentOffset = disclaimers.length;
                    currentPage = page; // Set the page user wants to go to
                    await fetchDisclaimers(currentOffset, SUBSEQUENT_API_LIMIT, false);
                } else {
                    currentPage = page;
                    renderRows(); // Just re-render with new page, no API call
                }
            });

            return button;
        }

        // Show pagination controls with ellipsis for large page counts
        if (totalPages >= 1) {
            const pages = [];

            if (totalPages <= maxVisiblePages + 2) {
                // Show all pages if total pages is small
                for (let i = 1; i <= totalPages; i += 1) {
                    pages.push(i);
                }
            } else {
                // Always show first page
                pages.push(1);

                // Calculate range around current page
                let startPage = Math.max(2, currentPage - 1);
                let endPage = Math.min(totalPages - 1, currentPage + 1);

                // Adjust range to show more pages when near start or end
                if (currentPage <= 3) {
                    endPage = Math.min(maxVisiblePages, totalPages - 1);
                } else if (currentPage >= totalPages - 2) {
                    startPage = Math.max(2, totalPages - maxVisiblePages + 1);
                }

                // Add ellipsis before middle pages if needed
                if (startPage > 2) {
                    pages.push('...');
                }

                // Add middle pages
                for (let i = startPage; i <= endPage; i += 1) {
                    pages.push(i);
                }

                // Add ellipsis after middle pages if needed
                if (endPage < totalPages - 1) {
                    pages.push('...');
                }

                // Always show last page
                pages.push(totalPages);
            }

            // Render pagination buttons
            pages.forEach((page) => {
                if (page === '...') {
                    const ellipsis = document.createElement('span');
                    ellipsis.className = 'pagination-ellipsis';
                    ellipsis.textContent = '...';
                    ellipsis.setAttribute('aria-hidden', 'true');
                    controls.append(ellipsis);
                } else {
                    controls.append(
                        createButton(
                            String(page),
                            page,
                            false,
                            page === currentPage,
                        ),
                    );
                }
            });
        }

        message.textContent = filteredDisclaimers.length
            ? ''
            : authorableSettings['no results'];
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

    // More Links toggle functionality
    const moreLinksButton = block.querySelector('.more-filters-button');
    const moreFiltersSection = block.querySelector('.more-filters-section');
    const chevronIcon = moreLinksButton.querySelector('.chevron-icon');

    moreLinksButton.addEventListener('click', () => {
        const isExpanded = moreLinksButton.getAttribute('aria-expanded') === 'true';

        if (isExpanded) {
            moreLinksButton.setAttribute('aria-expanded', 'false');
            moreFiltersSection.setAttribute('hidden', '');
            chevronIcon.style.transform = 'rotate(0deg)';
        } else {
            moreLinksButton.setAttribute('aria-expanded', 'true');
            moreFiltersSection.removeAttribute('hidden');
            chevronIcon.style.transform = 'rotate(180deg)';
        }
    });

    // Show loader
    function showLoader() {
        loaderContainer.removeAttribute('hidden');
        tbody.replaceChildren(); // Clear existing table data
        pagination.replaceChildren(); // Clear pagination
        message.textContent = '';
    }

    // Hide loader
    function hideLoader() {
        loaderContainer.setAttribute('hidden', '');
    }

    // Function to fetch disclaimers from API
    async function fetchDisclaimers(offset = 0, limit = null, resetData = true) {
        try {
            showLoader();

            // Determine the limit based on whether it's the initial load or subsequent load
            const fetchLimit = limit !== null ? limit : (isInitialLoad ? INITIAL_API_LIMIT : SUBSEQUENT_API_LIMIT);
            
            const apiUrl = buildApiUrl(offset, fetchLimit);
            const response = await fetch(apiUrl);

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

            const normalizedItems = items.map(dormalizeDisclaimer);

            // Check if we have more records to fetch
            if (isInitialLoad) {
                // First load - display all records including the 101st if present
                disclaimers = normalizedItems;
                
                // Check if we got 101 records (meaning more exist)
                hasMoreRecords = normalizedItems.length > SUBSEQUENT_API_LIMIT;
                
                isInitialLoad = false;
            } else {
                // Subsequent loads
                if (resetData) {
                    disclaimers = normalizedItems;
                    currentOffset = offset;
                    hasMoreRecords = normalizedItems.length >= SUBSEQUENT_API_LIMIT;
                } else {
                    // Append new records to existing ones
                    disclaimers = [...disclaimers, ...normalizedItems];
                    
                    // Check if there are more records
                    hasMoreRecords = normalizedItems.length >= SUBSEQUENT_API_LIMIT;
                    
                    // Don't reset page, just continue pagination
                    renderData(false);
                    return;
                }
            }

            renderData(resetData);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Unable to load disclaimers:', error);

            message.textContent =
                'Unable to load disclaimers. Check the API response and network connection.';
        } finally {
            hideLoader();
        }
    }

    // Search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            // Reset pagination state on new search
            currentOffset = 0;
            isInitialLoad = true;
            hasMoreRecords = false;
            fetchDisclaimers();
        }, 500); // 500ms debounce
    });

    // Product line filter change event
    productLineFilter.addEventListener('change', () => {
        // Reset pagination state on filter change
        currentOffset = 0;
        isInitialLoad = true;
        hasMoreRecords = false;
        fetchDisclaimers();
    });

    // Apply filters button click event
    applyFiltersButton.addEventListener('click', () => {
        // Reset pagination state on filter change
        currentOffset = 0;
        isInitialLoad = true;
        hasMoreRecords = false;
        fetchDisclaimers();
    });

    // Clear filters button click event
    clearFiltersButton.addEventListener('click', () => {
        // Reset all more filter fields
        stateFilter.value = '';
        regionFilter.value = '';
        regionFilter.innerHTML = '<option value="">Select Region</option>';
        regionFilter.disabled = true;
        
        // Uncheck all audience checkboxes
        audienceCheckboxes.forEach((checkbox) => {
            checkbox.checked = false;
        });
        
        // Reset pagination state and fetch disclaimers
        currentOffset = 0;
        isInitialLoad = true;
        hasMoreRecords = false;
        fetchDisclaimers();
    });

    // Function to fetch and populate Line of Business options
    async function fetchAndPopulateLOB() {
        try {
            const response = await fetch(LOB_API_URL);

            if (!response.ok) {
                throw new Error(`LOB API request failed: ${response.status}`);
            }

            const data = await response.json();
            const items = data?.data?.disclaimerHubList?.items;

            if (!Array.isArray(items)) {
                throw new Error('Unexpected LOB API response: data.disclaimerHubList.items is missing.');
            }

            // Extract unique LOB values
            const uniqueLOBs = [...new Set(
                items
                    .map(item => item.lineOfBusinessCategory)
                    .filter(lob => lob && lob.trim() !== '')
            )];

            // Sort alphabetically
            uniqueLOBs.sort((a, b) => a.localeCompare(b));

            // Populate the select box
            uniqueLOBs.forEach(lob => {
                const option = document.createElement('option');
                option.value = lob;
                option.textContent = lob;
                productLineFilter.appendChild(option);
            });

        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Unable to load Line of Business options:', error);
        }
    }

    // Function to parse regionMarket value and extract state and region
    function parseRegionMarket(regionMarketValue) {
        // Format: merkle:usa/{state}/{region}
        // Example: merkle:usa/pa/wpa -> state: pa, region: wpa
        const parts = regionMarketValue.split('/');
        
        if (parts.length >= 3 && parts[0] === 'merkle:usa') {
            return {
                state: parts[1],
                region: parts[2]
            };
        }
        
        return null;
    }

    // Function to fetch and populate State and Region options
    async function fetchAndPopulateStateRegions() {
        try {
            const response = await fetch(STATE_REGIONS_API_URL);

            if (!response.ok) {
                throw new Error(`State-Regions API request failed: ${response.status}`);
            }

            const data = await response.json();
            const items = data?.data?.disclaimerHubList?.items;

            if (!Array.isArray(items)) {
                throw new Error('Unexpected State-Regions API response: data.disclaimerHubList.items is missing.');
            }

            // Build a map of states to their regions
            const stateRegionsMap = {};

            items.forEach(item => {
                const regionMarkets = item.regionMarket || [];
                
                regionMarkets.forEach(regionMarketValue => {
                    const parsed = parseRegionMarket(regionMarketValue);
                    
                    if (parsed) {
                        const { state, region } = parsed;
                        
                        if (!stateRegionsMap[state]) {
                            stateRegionsMap[state] = new Set();
                        }
                        
                        stateRegionsMap[state].add(region);
                    }
                });
            });

            // Convert sets to sorted arrays and populate state dropdown
            const states = Object.keys(stateRegionsMap).sort();

            states.forEach(state => {
                const option = document.createElement('option');
                option.value = state;
                option.textContent = state.toUpperCase();
                stateFilter.appendChild(option);
            });

            // Add event listener to state filter to populate regions
            stateFilter.addEventListener('change', () => {
                const selectedState = stateFilter.value;
                
                // Check if state is selected and it's not "all"
                if (selectedState && selectedState.toLowerCase() !== 'all' && stateRegionsMap[selectedState]) {
                    // Clear existing region options
                    regionFilter.innerHTML = '';
                    
                    // Sort regions and populate the dropdown
                    const regions = Array.from(stateRegionsMap[selectedState]).sort();
                    
                    // Check if "all" exists in the regions data
                    const hasAllOption = regions.some((region) => region.toLowerCase() === 'all');
                    
                    // If "all" doesn't exist, add it as the first option
                    if (!hasAllOption) {
                        const allOption = document.createElement('option');
                        allOption.value = 'all';
                        allOption.textContent = 'ALL';
                        regionFilter.appendChild(allOption);
                    }
                    
                    // Add all regions from the data
                    regions.forEach((region) => {
                        const option = document.createElement('option');
                        option.value = region;
                        option.textContent = region.toUpperCase();
                        regionFilter.appendChild(option);
                    });
                    
                    // Explicitly set the region dropdown value to "all"
                    regionFilter.value = 'all';
                    
                    // Enable region dropdown
                    regionFilter.disabled = false;
                } else {
                    // When no state is selected or state is "all", disable region dropdown
                    regionFilter.innerHTML = '<option value="">Select Region</option>';
                    regionFilter.disabled = true;
                }
            });

            // Initially disable region dropdown until a state is selected
            regionFilter.disabled = true;

        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Unable to load State and Region options:', error);
        }
    }

    // Fetch filter options first, then fetch disclaimers
    fetchAndPopulateLOB();
    fetchAndPopulateStateRegions();
    
    // initial fetch on page load
    fetchDisclaimers();
}
