
export default async function decorate(block) {
  block.innerHTML = `
    <div class="disclosure-library">
      <h1>Disclosure Library</h1>
      <p>50 sample disclosures with usage history, edit requests, and a copyable dynamic short code for use across tools like SFMC.</p>

      <div class="disclosure-library-search">
        <label for="disclosure-search">Search disclosures</label>
        <input
          id="disclosure-search"
          type="search"
          placeholder="Search by disclosure name or short code..."
        />
      </div>

      <p class="disclosure-library-count" aria-live="polite"></p>

      <div class="disclosure-library-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Disclosure</th>
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
      <p class="disclosure-library-message" aria-live="polite"></p>
    </div>
  `;

  const searchInput = block.querySelector('#disclosure-search');
  const tbody = block.querySelector('tbody');
  const count = block.querySelector('.disclosure-library-count');
  const message = block.querySelector('.disclosure-library-message');

  let disclosures = [];

  const renderRows = (items) => {
    tbody.replaceChildren();

    items.forEach((item) => {
      const tr = document.createElement('tr');

      [
        item.name,
        item.lastUpdated,
        item.updatedBy,
        item.timesUsed,
      ].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value ?? '';
        tr.append(td);
      });

      const previewCell = document.createElement('td');
      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.textContent = 'Preview';
      previewButton.addEventListener('click', () => {
        window.alert(item.content || 'No preview available.');
      });
      previewCell.append(previewButton);
      tr.append(previewCell);

      const codeCell = document.createElement('td');
      const code = document.createElement('code');
      code.textContent = item.shortCode ?? '';
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = 'Copy';
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.shortCode ?? '');
          copyButton.textContent = 'Copied!';
          setTimeout(() => {
            copyButton.textContent = 'Copy';
          }, 1500);
        } catch {
          message.textContent = 'Unable to copy. Please copy the short code manually.';
        }
      });
      codeCell.append(code, copyButton);
      tr.append(codeCell);

      tbody.append(tr);
    });

    count.textContent = `Showing ${items.length} of ${disclosures.length} disclosures`;
    message.textContent = items.length ? '' : 'No disclosures found.';
  };

  try {
    const response = await fetch('/data/disclosures.json');

    if (!response.ok) {
      throw new Error(`Failed to load disclosures: ${response.status}`);
    }

    const data = await response.json();
    disclosures = Array.isArray(data) ? data : data.disclosures || [];
    renderRows(disclosures);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    message.textContent = 'Unable to load disclosures. Please check the JSON file path.';
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = disclosures.filter((item) => (
      [item.name, item.shortCode, item.updatedBy]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    ));
    renderRows(filtered);
  });
}
