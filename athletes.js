const athleteCategories = document.querySelector('#athlete-categories');
const athleteSearch = document.querySelector('#athlete-search');
const athleteSeason = document.querySelector('#athlete-season');
const athleteDivision = document.querySelector('#athlete-division');
const athleteResultCount = document.querySelector('#athlete-result-count');
const athleteNoResults = document.querySelector('#athlete-no-results');
const categoryHero = document.querySelector('#athlete-category-hero');
const categoryListing = document.querySelector('#athlete-category-listing');
const categoryTitle = document.querySelector('#athlete-category-title');
const categorySeasonLabel = document.querySelector('#athlete-category-season');
const categoryBackLink = document.querySelector('#athlete-category-back');
const categorySearch = document.querySelector('#athlete-category-search');
const categoryResultCount = document.querySelector('#athlete-category-result-count');
const categoryGrid = document.querySelector('#athlete-category-grid');
const categoryNoResults = document.querySelector('#athlete-category-no-results');
const categoryUnavailable = document.querySelector('#athlete-category-unavailable');

const isDirectoryPage = Boolean(
  athleteCategories
  && athleteSearch
  && athleteSeason
  && athleteDivision
  && athleteResultCount
  && athleteNoResults
);
const isCategoryPage = Boolean(
  categoryHero
  && categoryListing
  && categoryTitle
  && categorySeasonLabel
  && categoryBackLink
  && categorySearch
  && categoryResultCount
  && categoryGrid
  && categoryNoResults
  && categoryUnavailable
);

if (isDirectoryPage || isCategoryPage) {
  const rankingYears = window.upsaRankings;
  const athleteData = window.upsaAthleteData;
  if (!Array.isArray(rankingYears) || !athleteData) {
    throw new Error('Rankings and athlete data must load before the athlete pages.');
  }

  const seasons = [...rankingYears].sort((first, second) => Number(second.year) - Number(first.year));
  if (!seasons.length) {
    throw new Error('No ranking seasons are available for the athlete directory.');
  }

  const entriesByYear = new Map();
  const pointsValue = value => {
    const points = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(points) ? points : null;
  };
  const formatPoints = value => {
    const points = pointsValue(value);
    return points === null ? String(value) : points.toLocaleString('en-US');
  };
  const matchesSearch = (entry, searchTerm) => [
    entry.profile.name,
    entry.record.sourceName,
    entry.profile.athleteId,
    entry.profile.sourceAthleteId
  ]
    .filter(Boolean)
    .some(value => value.toLocaleLowerCase().includes(searchTerm));

  const getSeasonCategories = season => {
    if (entriesByYear.has(season.year)) return entriesByYear.get(season.year);

    const categories = season.categories.map(category => {
      const entries = category.rows.map(sourceRow => {
        const profileKey = athleteData.getProfileKeyForRankingRow(sourceRow);
        const profile = profileKey ? athleteData.getProfile(profileKey) : null;
        const record = profile && profile.rankings.find(item =>
          item.sourceRow === sourceRow
          && item.year === season.year
          && item.categoryTitle === category.title
        );

        if (!profile || !record) {
          throw new Error(`Could not resolve an athlete profile for ${category.title}.`);
        }

        return { profile, record };
      });

      entries.sort((first, second) => {
        const firstPoints = pointsValue(first.record.totalPoints);
        const secondPoints = pointsValue(second.record.totalPoints);
        if (firstPoints === null && secondPoints !== null) return 1;
        if (firstPoints !== null && secondPoints === null) return -1;
        if (firstPoints !== null && secondPoints !== null && firstPoints !== secondPoints) {
          return secondPoints - firstPoints;
        }
        return first.record.rowIndex - second.record.rowIndex;
      });

      return {
        key: entries[0]?.record.division.key || '',
        label: entries[0]?.record.division.label || category.title,
        entries
      };
    });

    entriesByYear.set(season.year, categories);
    return categories;
  };

  const createPlaceholder = (name, label) => {
    const placeholder = document.createElement('span');
    placeholder.className = 'athlete-photo-placeholder';
    placeholder.setAttribute('aria-label', `${label} for ${name}`);

    const initials = document.createElement('b');
    initials.textContent = name.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toLocaleUpperCase();
    const note = document.createElement('small');
    note.textContent = label;
    placeholder.append(initials, note);
    return placeholder;
  };

  const createCard = (entry, categoryLabel) => {
    const { profile, record } = entry;
    const card = document.createElement('a');
    card.className = 'athlete-card';
    card.href = athleteData.getProfileHref(profile.key);
    card.setAttribute(
      'aria-label',
      `${record.sourceName}, rank ${record.rank}, ${formatPoints(record.totalPoints)} points, ${categoryLabel}`
    );

    const visual = document.createElement('span');
    visual.className = 'athlete-card-visual';
    if (profile.profilePhoto || profile.coverPhoto) {
      const image = document.createElement('img');
      image.src = profile.profilePhoto || profile.coverPhoto;
      image.alt = `${record.sourceName} athlete photograph`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        image.remove();
        visual.append(createPlaceholder(record.sourceName, 'Cover photo unavailable'));
      }, { once: true });
      visual.append(image);
    } else {
      visual.append(createPlaceholder(record.sourceName, 'Photo unavailable'));
    }

    const rank = document.createElement('span');
    rank.className = 'athlete-card-rank';
    rank.textContent = `Rank ${record.rank}`;
    visual.append(rank);

    const content = document.createElement('span');
    content.className = 'athlete-card-content';
    const eyebrow = document.createElement('small');
    eyebrow.textContent = profile.athleteId
      ? `Athlete ID ${profile.athleteId}`
      : profile.sourceAthleteId
        ? `Source ID ${profile.sourceAthleteId} · unverified`
        : 'Athlete ID not listed';
    const name = document.createElement('strong');
    name.textContent = record.sourceName;
    const division = document.createElement('span');
    division.className = 'athlete-card-divisions';
    division.textContent = categoryLabel;
    const points = document.createElement('span');
    points.className = 'athlete-card-points';
    const pointsValueLabel = document.createElement('strong');
    pointsValueLabel.textContent = formatPoints(record.totalPoints);
    const pointsCaption = document.createElement('small');
    pointsCaption.textContent = 'Total points';
    points.append(pointsValueLabel, pointsCaption);

    content.append(eyebrow, name, division, points);
    card.append(visual, content);
    return card;
  };

  const createCategorySection = (category, seasonYear) => {
    const section = document.createElement('section');
    section.className = 'athlete-category-section';
    const categoryId = `athlete-category-${seasonYear}-${category.key || 'unlisted'}`;
    section.setAttribute('aria-labelledby', categoryId);

    const heading = document.createElement('div');
    heading.className = 'athlete-category-heading';
    const headingCopy = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.textContent = `${seasonYear} season standings`;
    const title = document.createElement('h3');
    title.id = categoryId;
    title.textContent = category.label;
    headingCopy.append(kicker, title);

    const count = document.createElement('span');
    count.className = 'athlete-category-count';
    count.textContent = `${category.entries.length} ${category.entries.length === 1 ? 'ranked surfer' : 'ranked surfers'}`;
    heading.append(headingCopy, count);

    const grid = document.createElement('div');
    grid.className = 'athlete-directory-grid';
    grid.id = `${categoryId}-surfers`;
    grid.append(...category.entries.slice(0, 10).map(entry => createCard(entry, category.label)));

    const moreLink = document.createElement('a');
    moreLink.className = 'athlete-category-more';
    const categoryTotal = category.totalEntries ?? category.entries.length;
    moreLink.hidden = categoryTotal <= 10;
    const categoryUrl = new URL('athlete-category.html', document.baseURI);
    categoryUrl.searchParams.set('season', String(seasonYear));
    categoryUrl.searchParams.set('category', category.key);
    moreLink.href = categoryUrl.href;
    moreLink.setAttribute(
      'aria-label',
      `Show all ${categoryTotal} ${category.label} surfers for ${seasonYear}`
    );
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    moreLink.append(
      document.createTextNode(`Show more · ${categoryTotal} surfers`),
      arrow
    );
    section.append(heading, grid, moreLink);
    return section;
  };

  if (isDirectoryPage) {
    const populateDivisionOptions = season => {
      const selectedDivision = athleteDivision.value;
      const categories = getSeasonCategories(season);
      athleteDivision.replaceChildren(new Option('All categories', ''));
      categories.forEach(category => {
        if (!category.key) return;
        athleteDivision.append(new Option(category.label, category.key));
      });
      athleteDivision.value = categories.some(category => category.key === selectedDivision)
        ? selectedDivision
        : '';
    };

    seasons.forEach(season => {
      athleteSeason.append(new Option(String(season.year), String(season.year)));
    });
    const requestedParams = new URLSearchParams(window.location.search);
    const initialSeason = seasons.find(season => String(season.year) === requestedParams.get('season')) || seasons[0];
    athleteSeason.value = String(initialSeason.year);
    populateDivisionOptions(initialSeason);
    const requestedCategory = requestedParams.get('category');
    if ([...athleteDivision.options].some(option => option.value === requestedCategory)) {
      athleteDivision.value = requestedCategory;
    }

    const renderDirectory = () => {
      const season = seasons.find(item => String(item.year) === athleteSeason.value);
      if (!season) {
        throw new Error(`No ranking season found for ${athleteSeason.value}.`);
      }

      const searchTerm = athleteSearch.value.trim().toLocaleLowerCase();
      const selectedDivision = athleteDivision.value;
      const visibleCategories = getSeasonCategories(season)
        .filter(category => !selectedDivision || category.key === selectedDivision)
        .map(category => ({
          ...category,
          totalEntries: category.entries.length,
          entries: category.entries.filter(entry => matchesSearch(entry, searchTerm))
        }))
        .filter(category => category.entries.length > 0);

      const totalEntries = visibleCategories.reduce((total, category) => total + category.entries.length, 0);
      athleteResultCount.textContent = `${totalEntries} ranked ${totalEntries === 1 ? 'entry' : 'entries'} · ${visibleCategories.length} ${visibleCategories.length === 1 ? 'category' : 'categories'} · ${season.year} season`;
      athleteNoResults.hidden = totalEntries > 0;
      athleteCategories.replaceChildren(...visibleCategories.map(category =>
        createCategorySection(category, season.year)
      ));
    };

    athleteSearch.addEventListener('input', renderDirectory);
    athleteDivision.addEventListener('change', renderDirectory);
    athleteSeason.addEventListener('change', () => {
      const season = seasons.find(item => String(item.year) === athleteSeason.value);
      if (!season) {
        throw new Error(`No ranking season found for ${athleteSeason.value}.`);
      }
      populateDivisionOptions(season);
      renderDirectory();
    });
    renderDirectory();
  }

  if (isCategoryPage) {
    const params = new URLSearchParams(window.location.search);
    const season = seasons.find(item => String(item.year) === params.get('season'));
    const category = season
      ? getSeasonCategories(season).find(item => item.key === params.get('category'))
      : null;

    if (!season || !category) {
      categoryUnavailable.hidden = false;
      document.title = 'Athlete Category Not Found | UPSA';
    } else {
      categoryHero.hidden = false;
      categoryListing.hidden = false;
      categorySeasonLabel.textContent = `${season.year} season standings`;
      categoryTitle.textContent = category.label;
      document.querySelector('#athlete-category-list-title').textContent = `${category.label} standings`;
      document.querySelector('#athlete-category-summary').textContent =
        `All ${category.entries.length} recorded surfers, sorted by total points from highest to lowest.`;

      const backUrl = new URL('athletes.html', document.baseURI);
      backUrl.searchParams.set('season', String(season.year));
      backUrl.searchParams.set('category', category.key);
      categoryBackLink.href = backUrl.href;

      document.title = `${category.label} Athletes | ${season.year} | UPSA`;
      const renderCategory = () => {
        const searchTerm = categorySearch.value.trim().toLocaleLowerCase();
        const visibleEntries = category.entries.filter(entry => matchesSearch(entry, searchTerm));
        categoryResultCount.textContent = `${visibleEntries.length} ranked ${visibleEntries.length === 1 ? 'surfer' : 'surfers'} · ${season.year} season`;
        categoryNoResults.hidden = visibleEntries.length > 0;
        categoryGrid.replaceChildren(...visibleEntries.map(entry => createCard(entry, category.label)));
      };

      categorySearch.addEventListener('input', renderCategory);
      renderCategory();
    }
  }
}
