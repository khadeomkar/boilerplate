
const API_URL = 'https://api.npoint.io/aea8e183fa49cbca071f';
const PAGE_SIZE = 10;

export default async function decorate(block) {
  // Preserve the title and description authored in EDS.
  const authoredContent = [...block.children];

  const title = authoredContent[0]?.querySelector('h1, h2, h3, h4, h5, h6');
  const description = authoredContent[1];

  // Build the disclosure library UI.
  block.innerHTML = `
    <div class="disclosure-library">
      <div class="disclosure-library-header">
        <h2 class="disclosure-library-title"></h2>
        <div class="disclosure-description"></div>
      </div>

      <div class="disclosure-library-search">
        <label for="disclosure-search">Search disclosures</label>
        <input
          id="disclosure-search"
          type="search"
          placeholder="Search by name, short code, or updated by..."
        />
      </div>

      <div class="disclosure-library-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Disclosure Name</th>
              <th>Last Updated</th>
              <th>Updated By</th>
              <th>Times Used</th>
              <th>Preview</th>
              <th>Short Code</th>
            </tr>
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

  // Use the authored title and description.
  if (title) {
    titleContainer.replaceWith(title.cloneNode(true));
  }

  if (description) {
    descriptionContainer.innerHTML = description.innerHTML;
  }

  const searchInput = block.querySelector('#disclosure-search');
  const tbody = block.querySelector('tbody');
  const pagination = block.querySelector('.disclosure-pagination');
  const message = block.querySelector('.disclosure-library-message');

  let disclosures = [];
  let filteredDisclosures = [];
  let currentPage = 1;

  function renderRows() {
    tbody.replaceChildren();
    pagination.replaceChildren();

    const totalRecords = filteredDisclosures.length;
    const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

    currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, totalRecords);
    const paginatedItems = filteredDisclosures.slice(startIndex, endIndex);

    paginatedItems.forEach((item) => {
      const row = document.createElement('tr');

      [item.name, item.lastUpdated, item.updatedBy, item.timesUsed]
        .forEach((value) => {
          const cell = document.createElement('td');
          cell.textContent = value ?? '';
          row.append(cell);
        });

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

      const codeCell = document.createElement('td');
      const code = document.createElement('code');
      const copyButton = document.createElement('button');

      code.textContent = item.shortCode ?? '';
      copyButton.type = 'button';
      copyButton.textContent = 'Copy';

      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.shortCode ?? '');
          copyButton.textContent = 'Copied!';

          window.setTimeout(() => {
            copyButton.textContent = 'Copy';
          }, 1500);
        } catch {
          message.textContent =
            'Copy failed. Please copy the short code manually.';
        }
      });

      codeCell.append(code, copyButton);
      row.append(codeCell);
      tbody.append(row);
    });

    const recordCount = document.createElement('p');
    recordCount.className = 'disclosure-record-count';

    recordCount.textContent =
      `Showing ${totalRecords ? startIndex + 1 : 0}-${endIndex} of ${totalRecords} records`;

    pagination.append(recordCount);

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
          createButton(String(page), page, false, page === currentPage),
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

    disclosures = Array.isArray(data) ? data : data.disclosures || [];
    filteredDisclosures = [...disclosures];

    renderRows();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to load disclosures:', error);
    message.textContent =
      'Unable to load disclosures. Please check the API or network connection.';
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();

    filteredDisclosures = disclosures.filter((item) => (
      [item.name, item.shortCode, item.updatedBy]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    ));

    currentPage = 1;
    renderRows();
  });
}
