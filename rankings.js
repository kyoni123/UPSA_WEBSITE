const rankingPage = document.querySelector('[data-ranking-year]');

if (rankingPage) {
  const year = Number(rankingPage.dataset.rankingYear);
  const ranking = window.upsaRankings.find(entry => entry.year === year);
  const categories = document.querySelector('#ranking-categories');
  const categoryTabs = document.querySelector('#ranking-category-tabs');
  const yearSelect = document.querySelector('#ranking-year-select');
  const rules = document.querySelector('#ranking-rules');

  if (!ranking) {
    throw new Error(`No UPSA rankings data found for ${year}.`);
  }

  document.title = `${year} Rankings | United Philippine Surfing Association`;
  document.querySelector('#ranking-title').textContent = `${year} Rankings`;
  document.querySelector('#ranking-intro').textContent = `Official ${year} Pilipinas Surfing National Tour standings by division and event leg.`;

  yearSelect.value = `${year}-tour.html`;
  yearSelect.addEventListener('change', () => {
    window.location.href = yearSelect.value;
  });

  const reminders = ranking.notices.filter(notice => notice !== 'Points and Ranking Rules');
  if (reminders.length) {
    const reminderPanel = document.querySelector('#ranking-reminders');
    if (year === 2026 && reminders[0].includes('Membership is REQUIRED')) {
      const notice = reminders[0].replace(/^REMINDERS:\s*/, '');
      const membershipIndex = notice.indexOf('Membership is REQUIRED');
      const reminderLines = notice.slice(0, membershipIndex).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const membershipCopy = notice.slice(membershipIndex + 'Membership is REQUIRED'.length).trim();

      const heading = document.createElement('h2');
      heading.id = 'ranking-reminders-title';
      heading.textContent = '2026 Tour Reminders';
      reminderPanel.append(heading);

      const bestResults = document.createElement('div');
      bestResults.className = 'ranking-best-results';
      const resultsHeading = document.createElement('h3');
      resultsHeading.textContent = reminderLines.shift() || 'Top Four Best Results';
      bestResults.append(resultsHeading);
      const resultsCopy = document.createElement('p');
      resultsCopy.textContent = reminderLines.join(' ');
      bestResults.append(resultsCopy);
      reminderPanel.append(bestResults);

      const membershipCallout = document.createElement('aside');
      membershipCallout.className = 'ranking-membership-callout';
      membershipCallout.setAttribute('aria-labelledby', 'ranking-membership-title');

      const calloutCopy = document.createElement('div');
      calloutCopy.className = 'ranking-membership-copy';
      const eyebrow = document.createElement('span');
      eyebrow.textContent = 'Athlete membership';
      const calloutHeading = document.createElement('h3');
      calloutHeading.id = 'ranking-membership-title';
      calloutHeading.textContent = 'Membership is required';
      const paragraph = document.createElement('p');
      paragraph.textContent = membershipCopy;
      calloutCopy.append(eyebrow, calloutHeading, paragraph);

      const registerLink = document.createElement('a');
      registerLink.className = 'ranking-register-link';
      registerLink.href = '../membership/membership.html#membership-flow';
      registerLink.append('Register or renew ', document.createElement('span'));
      registerLink.lastElementChild.textContent = '↗';

      membershipCallout.append(calloutCopy, registerLink);
      reminderPanel.append(membershipCallout);
    } else {
      const heading = document.createElement('h2');
      heading.id = 'ranking-reminders-title';
      heading.textContent = 'Reminders';
      reminderPanel.append(heading);
      reminders.forEach(text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text.replace(/^REMINDERS:\s*/, '');
        reminderPanel.append(paragraph);
      });
    }
    reminderPanel.hidden = false;
  }

  const categoryPanels = [];
  const categoryButtons = [];

  ranking.categories.forEach((category, index) => {
    const tabId = `ranking-category-tab-${index}`;
    const panelId = `ranking-category-panel-${index}`;
    const tab = document.createElement('button');
    tab.id = tabId;
    tab.type = 'button';
    tab.className = 'ranking-category-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panelId);
    tab.setAttribute('aria-selected', 'false');
    tab.tabIndex = -1;
    tab.textContent = category.title.replace(/^\d{4}\s*/, '');
    categoryTabs.append(tab);
    categoryButtons.push(tab);

    const article = document.createElement('article');
    article.className = 'ranking-category';
    article.id = panelId;
    article.setAttribute('role', 'tabpanel');
    article.setAttribute('aria-labelledby', tabId);
    article.tabIndex = 0;
    article.hidden = true;

    const heading = document.createElement('h2');
    heading.textContent = category.title;

    const controls = document.createElement('div');
    controls.className = 'ranking-table-controls';

    const lengthLabel = document.createElement('label');
    lengthLabel.className = 'ranking-page-length';
    lengthLabel.append('Show ');
    const lengthSelect = document.createElement('select');
    [10, 25, 50, 100].forEach(size => {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = String(size);
      lengthSelect.append(option);
    });
    lengthLabel.append(lengthSelect, ' entries');

    const searchLabel = document.createElement('label');
    searchLabel.className = 'ranking-search';
    searchLabel.append('Search ');
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.setAttribute('aria-label', `Search ${category.title}`);
    searchLabel.append(searchInput);
    controls.append(lengthLabel, searchLabel);

    const scroller = document.createElement('div');
    scroller.className = 'ranking-table-scroll';
    scroller.tabIndex = 0;
    scroller.setAttribute('role', 'region');
    scroller.setAttribute('aria-label', `${category.title} table; scroll horizontally to see all columns`);

    const table = document.createElement('table');
    table.className = 'ranking-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const nameColumnIndex = category.headers.findIndex(label => /^name$/i.test(label));
    category.headers.forEach(label => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      headerRow.append(cell);
    });
    thead.append(headerRow);
    table.append(thead);

    const tbody = document.createElement('tbody');
    table.append(tbody);
    scroller.append(table);

    const pageStatus = document.createElement('p');
    pageStatus.className = 'ranking-page-status';
    pageStatus.setAttribute('aria-live', 'polite');
    const pagination = document.createElement('div');
    pagination.className = 'ranking-pagination';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.textContent = 'Previous';
    const pageNumber = document.createElement('span');
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = 'Next';
    pagination.append(previous, pageNumber, next);

    let currentPage = 1;
    const renderRows = () => {
      const searchTerm = searchInput.value.trim().toLocaleLowerCase();
      const matchingRows = category.rows.filter(values =>
        values.join(' ').toLocaleLowerCase().includes(searchTerm)
      );
      const pageSize = Number(lengthSelect.value);
      const pageCount = Math.max(1, Math.ceil(matchingRows.length / pageSize));
      currentPage = Math.min(currentPage, pageCount);
      const firstIndex = (currentPage - 1) * pageSize;
      const visibleRows = matchingRows.slice(firstIndex, firstIndex + pageSize);

      tbody.replaceChildren();
      visibleRows.forEach(values => {
        const row = document.createElement('tr');
        values.forEach((value, index) => {
          const cell = document.createElement(index === 0 ? 'th' : 'td');
          if (index === 0) cell.scope = 'row';
          const profileKey = index === nameColumnIndex && window.upsaAthleteData
            ? window.upsaAthleteData.getProfileKeyForRankingRow(values)
            : null;
          if (profileKey) {
            const link = document.createElement('a');
            link.className = 'ranking-athlete-link';
            link.href = window.upsaAthleteData.getProfileHref(profileKey);
            link.textContent = value;
            cell.append(link);
          } else {
            cell.textContent = value;
          }
          row.append(cell);
        });
        tbody.append(row);
      });

      if (!visibleRows.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = category.headers.length;
        cell.textContent = 'No matching rankings.';
        row.append(cell);
        tbody.append(row);
      }

      pageStatus.textContent = matchingRows.length
        ? `Showing ${firstIndex + 1} to ${firstIndex + visibleRows.length} of ${matchingRows.length} entries`
        : 'Showing 0 to 0 of 0 entries';
      pageNumber.textContent = `Page ${currentPage} of ${pageCount}`;
      previous.disabled = currentPage === 1;
      next.disabled = currentPage === pageCount;
    };

    lengthSelect.addEventListener('change', () => {
      currentPage = 1;
      renderRows();
    });
    searchInput.addEventListener('input', () => {
      currentPage = 1;
      renderRows();
    });
    previous.addEventListener('click', () => {
      currentPage -= 1;
      renderRows();
    });
    next.addEventListener('click', () => {
      currentPage += 1;
      renderRows();
    });

    renderRows();
    article.append(heading, controls, scroller, pageStatus, pagination);
    categories.append(article);
    categoryPanels.push(article);
  });

  const activateCategory = (index, moveFocus = false) => {
    categoryButtons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === index;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      categoryPanels[buttonIndex].hidden = !selected;
    });
    if (moveFocus) categoryButtons[index].focus();
  };

  categoryButtons.forEach((button, index) => {
    button.addEventListener('click', () => activateCategory(index));
    button.addEventListener('keydown', event => {
      let nextIndex = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (index + 1) % categoryButtons.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (index - 1 + categoryButtons.length) % categoryButtons.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = categoryButtons.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      activateCategory(nextIndex, true);
    });
  });
  activateCategory(0);

  const rulesHeading = document.createElement('h2');
  rulesHeading.id = 'ranking-rules-title';
  rulesHeading.textContent = 'Points and Ranking Rules';
  rules.append(rulesHeading);

  const appendText = (tagName, text) => {
    const element = document.createElement(tagName);
    element.textContent = text;
    rules.append(element);
    return element;
  };

  appendText('p', 'As the official National Sports Association (NSA) for surfing in the Philippines, the United Philippine Surfing Association (UPSA) is responsible for the selection of the Philippine National Surfing Team, across all divisions, categories and age brackets.');
  appendText('p', 'Only the top four (4) athletes in both Men’s and Women’s Open Shortboard and Longboard divisions shall be considered for the Philippine Surfing National Team’s selection criteria.');
  appendText('h3', 'Selection Criteria of the UPSA Rule Book');
  appendText('p', 'Selection is based on:');

  const selectionList = document.createElement('ul');
  [
    'UPSA-sanctioned National Events',
    'International-sanctioned Events, such as WSL where the qualification level exceeds the parallel level of the UPSA National Events.',
    'WSL Challenger Series (CS)',
    'WSL Championship Tour (Shortboard)',
    'WSL World Longboard Tour (Longboard)'
  ].forEach(text => {
    const item = document.createElement('li');
    item.textContent = text;
    selectionList.append(item);
  });
  rules.append(selectionList);

  appendText('h3', 'Rankings and Seedings Selection');
  appendText('p', 'UPSA reserves the right to provide positions for the top 16 seeded surfers based on tournament rankings (Section III. Article 1.6 of the UPSA Rule Book).');
  appendText('p', 'Final results for the UPSA National Tour will be calculated of the four (4) best results of the year. In the event there are four (4) or less events, all events will be counted (Section V. Article 1 of the UPSA Rule Book).');
  appendText('p', 'In the event of an equal ranking tie break while the National Tour is on-going, the selection for the first seeded equal rank for the next event will be based on the following technicalities:');

  const tieBreakList = document.createElement('ul');
  [
    'The first seeded will be the athlete that reached the highest round in the previous event.',
    'If athletes with equal ranks reached the same round in the previous event, then the selection for the first seeded is the athlete that reached the highest total heat score from the previous event.'
  ].forEach(text => {
    const item = document.createElement('li');
    item.textContent = text;
    tieBreakList.append(item);
  });
  rules.append(tieBreakList);

  const inquiry = appendText('p', 'For any inquiries regarding the rankings, please contact UPSA on Facebook and Instagram, or send an email to hello@upsa.ph with the following email subject:');
  const subject = appendText('p', 'Email Subject: Rankings Inquiry – Full Name of Athlete – Division');
  const facebook = document.createElement('a');
  facebook.href = 'https://www.facebook.com/officialupsa.ph';
  facebook.textContent = 'Facebook';
  facebook.target = '_blank';
  facebook.rel = 'noopener noreferrer';
  const instagram = document.createElement('a');
  instagram.href = 'https://www.instagram.com/upsa.ph';
  instagram.textContent = 'Instagram';
  instagram.target = '_blank';
  instagram.rel = 'noopener noreferrer';
  const email = document.createElement('a');
  email.href = 'mailto:hello@upsa.ph';
  email.textContent = 'hello@upsa.ph';
  inquiry.replaceChildren('For any inquiries regarding the rankings, please contact us on ', facebook, ' and ', instagram, ', or send us an email at ', email, ' with the following email subject:');
  subject.classList.add('ranking-email-subject');
}
