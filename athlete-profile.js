const profileRoot = document.querySelector('#athlete-profile-content');
const unavailableRoot = document.querySelector('#athlete-profile-unavailable');
const profileKey = new URLSearchParams(window.location.search).get('athlete');
const athleteProfile = profileKey ? window.upsaAthleteData.getProfile(profileKey) : null;

const initialsFor = name => name
  .split(/\s+/)
  .slice(0, 2)
  .map(part => part.charAt(0))
  .join('')
  .toLocaleUpperCase();

const getNumericRank = record => Number(String(record.rank).replace(/[^\d]/g, ''));

const createStat = (label, value, detail) => {
  const stat = document.createElement('article');
  stat.className = 'athlete-stat';
  const statLabel = document.createElement('span');
  statLabel.textContent = label;
  const statValue = document.createElement('strong');
  statValue.textContent = value;
  const statDetail = document.createElement('small');
  statDetail.textContent = detail;
  stat.append(statLabel, statValue, statDetail);
  return stat;
};

const escapeHtml = value => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const renderRankingChart = profile => {
  const chart = document.querySelector('#athlete-ranking-chart');
  const chartTable = document.querySelector('#athlete-ranking-chart-table');
  const chartBody = chartTable.querySelector('tbody');
  const numericRecords = profile.rankings
    .map(record => ({ ...record, numericRank: getNumericRank(record) }))
    .filter(record => Number.isFinite(record.numericRank));

  if (!numericRecords.length) {
    chart.hidden = true;
    chartTable.hidden = true;
    chart.insertAdjacentHTML('afterend', '<p class="athlete-section-intro">No numeric ranking records are available for charting.</p>');
    return;
  }

  const sortedRecords = [...numericRecords].sort((first, second) =>
    first.year - second.year
    || first.division.label.localeCompare(second.division.label)
  );
  const seasons = [...new Set(sortedRecords.map(record => record.year))]
    .sort((first, second) => first - second);
  const divisionGroups = new Map();
  sortedRecords.forEach(record => {
    if (!divisionGroups.has(record.division.key)) {
      divisionGroups.set(record.division.key, {
        label: record.division.label,
        records: []
      });
    }
    divisionGroups.get(record.division.key).records.push(record);
  });

  const width = 900;
  const height = 300;
  const margin = { top: 24, right: 28, bottom: 55, left: 52 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxRank = Math.max(...numericRecords.map(record => record.numericRank));
  const rankCeiling = Math.max(10, Math.ceil(maxRank / 10) * 10);
  const xFor = year => seasons.length === 1
    ? margin.left + plotWidth / 2
    : margin.left + ((year - seasons[0]) / (seasons[seasons.length - 1] - seasons[0])) * plotWidth;
  const yFor = rank => margin.top + (rank / rankCeiling) * plotHeight;
  const colors = ['#b9d12f', '#38a4bd', '#ef8e60', '#8e78b3', '#e4b84b'];

  let svg = `<svg viewBox="0 0 ${width} ${height}" aria-labelledby="athlete-ranking-chart-title" aria-describedby="athlete-ranking-chart-description"><title id="athlete-ranking-chart-title">Season ranking progression for ${escapeHtml(profile.name)}</title>`;
  const gridStep = rankCeiling <= 20 ? 2 : Math.max(10, rankCeiling / 5);
  for (let rank = 1; rank <= rankCeiling; rank += gridStep) {
    const y = yFor(rank);
    svg += `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="athlete-chart-grid"/>`;
    svg += `<text x="${margin.left - 12}" y="${y + 4}" class="athlete-chart-axis-text" text-anchor="end">${rank}</text>`;
  }

  seasons.forEach(year => {
    const x = xFor(year);
    svg += `<text x="${x}" y="${height - 20}" class="athlete-chart-axis-text" text-anchor="middle">${year}</text>`;
  });

  let seriesIndex = 0;
  divisionGroups.forEach(group => {
    const color = colors[seriesIndex % colors.length];
    const recordsBySeason = new Map();
    group.records.forEach(record => {
      if (!recordsBySeason.has(record.year)) recordsBySeason.set(record.year, []);
      recordsBySeason.get(record.year).push(record);
    });
    const points = [...recordsBySeason.entries()]
      .sort((first, second) => first[0] - second[0])
      .map(([year, records]) => {
        const ranks = records.map(record => record.numericRank);
        const rank = Math.min(...ranks);
        return `${xFor(year)},${yFor(rank)}`;
      })
      .join(' ');
    svg += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
    recordsBySeason.forEach((records, year) => {
      records.forEach(record => {
        svg += `<circle cx="${xFor(year)}" cy="${yFor(record.numericRank)}" r="7" fill="${color}" stroke="#ffffff" stroke-width="3"><title>${escapeHtml(record.year)} - ${escapeHtml(record.division.label)} - Rank ${record.rank}</title></circle>`;
      });
    });
    svg += `<text x="${width - margin.right}" y="${margin.top + 18 + seriesIndex * 18}" class="athlete-chart-series" fill="${color}" text-anchor="end">${escapeHtml(group.label)}</text>`;
    seriesIndex += 1;
  });
  svg += '</svg>';
  chart.innerHTML = svg;

  chartBody.replaceChildren();
  sortedRecords.forEach(record => {
    const row = document.createElement('tr');
    [String(record.year), record.division.label, record.rank].forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value;
      row.append(cell);
    });
    chartBody.append(row);
  });
};

if (profileRoot && unavailableRoot) {
  if (!athleteProfile) {
    unavailableRoot.hidden = false;
    document.title = 'Athlete Profile Unavailable | UPSA';
  } else {
    profileRoot.hidden = false;
    document.title = `${athleteProfile.name} | UPSA Athlete Profile`;

    const coverImage = document.querySelector('#athlete-cover-image');
    const coverFallback = document.querySelector('#athlete-cover-fallback');
    const portraitImage = document.querySelector('#athlete-profile-image');
    const portraitInitials = document.querySelector('#athlete-profile-initials');
    const portraitPhotoNote = document.querySelector('#athlete-profile-photo-note');
    portraitInitials.textContent = initialsFor(athleteProfile.name);

    if (athleteProfile.coverPhoto) {
      coverImage.src = athleteProfile.coverPhoto;
      coverImage.alt = `${athleteProfile.name} athlete cover photograph`;
      coverImage.hidden = false;
      coverImage.addEventListener('error', () => {
        coverImage.hidden = true;
        coverFallback.hidden = false;
      }, { once: true });
    } else {
      coverFallback.hidden = false;
    }

    if (athleteProfile.profilePhoto) {
      portraitImage.src = athleteProfile.profilePhoto;
      portraitImage.alt = `${athleteProfile.name} athlete profile photograph`;
      portraitImage.hidden = false;
      portraitInitials.hidden = true;
      portraitPhotoNote.hidden = true;
      portraitImage.addEventListener('error', () => {
        portraitImage.hidden = true;
        portraitInitials.hidden = false;
        portraitPhotoNote.hidden = false;
      }, { once: true });
    }

    document.querySelector('#athlete-name').textContent = athleteProfile.name;
    const athleteId = document.querySelector('#athlete-id');
    athleteId.textContent = athleteProfile.athleteId
      ? `Athlete ID ${athleteProfile.athleteId}`
      : athleteProfile.sourceAthleteId
        ? `Source Athlete ID ${athleteProfile.sourceAthleteId} · not verified`
        : 'Athlete ID not listed in available records';

    if (athleteProfile.nationality) {
      const nationality = document.querySelector('#athlete-nationality');
      nationality.textContent = athleteProfile.nationality;
      nationality.hidden = false;
    }
    const locationDetails = [athleteProfile.surfClub, athleteProfile.hometown].filter(Boolean);
    if (locationDetails.length) {
      const location = document.querySelector('#athlete-profile-location');
      location.textContent = locationDetails.join(' · ');
      location.hidden = false;
    }

    const divisionContainer = document.querySelector('#athlete-divisions');
    athleteProfile.divisions.forEach(division => {
      const tag = document.createElement('span');
      tag.textContent = division.label;
      divisionContainer.append(tag);
    });

    const identityNotes = [];
    if (athleteProfile.identityConflict) {
      identityNotes.push('The ranking source assigns this Athlete ID to different names across divisions. This entry is kept separate until the source data is verified.');
    } else if (athleteProfile.duplicateSourceName) {
      identityNotes.push('The source contains multiple rows for this exact name in the same division and season. This entry has not been merged with those rows.');
    } else if (athleteProfile.athleteId && athleteProfile.hasProvisionalNameMatch) {
      identityNotes.push('Older rankings without Athlete IDs are included only when their exact source name matches this profile.');
    } else if (!athleteProfile.athleteId) {
      identityNotes.push('This name-only profile groups exact source-name matches. The 2022–2024 rankings do not include Athlete IDs, so identity across records is not independently verified.');
    }
    if (athleteProfile.nameVariants.length > 1) {
      identityNotes.push(`Source rankings use these name spellings: ${athleteProfile.nameVariants.join('; ')}.`);
    }
    if (identityNotes.length) {
      const note = document.querySelector('#athlete-identity-note');
      note.textContent = identityNotes.join(' ');
      note.hidden = false;
    }

    const numericRanks = athleteProfile.rankings
      .map(record => getNumericRank(record))
      .filter(Number.isFinite);
    const bestRank = numericRanks.length ? Math.min(...numericRanks) : null;
    const bestRecords = athleteProfile.rankings.filter(record => getNumericRank(record) === bestRank);
    const firstPlaceRecords = athleteProfile.rankings.filter(record => getNumericRank(record) === 1);
    const statItems = [
      { label: 'Seasons represented', value: String(athleteProfile.seasons.length), detail: athleteProfile.seasons.join(' · ') },
      { label: 'Divisions represented', value: String(athleteProfile.divisions.length), detail: athleteProfile.divisions.map(division => division.label).join(' · ') },
      {
        label: 'Best recorded ranking',
        value: bestRank === null ? '—' : `#${bestRank}`,
        detail: bestRecords.length
          ? bestRecords.map(record => `${record.division.label} · ${record.year}`).join(' · ')
          : 'No numeric rank available'
      },
      {
        label: 'Ranking entries',
        value: String(athleteProfile.rankings.length),
        detail: 'Season-ranking records'
      },
      {
        label: 'First-place rankings',
        value: String(firstPlaceRecords.length),
        detail: firstPlaceRecords.length
          ? firstPlaceRecords.map(record => `${record.year} · ${record.division.label}`).join(' · ')
          : 'No recorded #1 season ranking'
      }
    ];
    const stats = document.querySelector('#athlete-stats');
    stats.append(...statItems.map(item => createStat(item.label, item.value, item.detail)));

    renderRankingChart(athleteProfile);

    const rankingHistory = document.querySelector('#athlete-ranking-history');
    const legHistory = document.querySelector('#athlete-leg-history');
    athleteProfile.rankings.forEach(record => {
      const rankingRow = document.createElement('tr');
      [
        String(record.year),
        record.categoryTitle.replace(/^\d{4}\s*/, ''),
        record.rank,
        record.totalPoints,
        record.matchType === 'source-id'
          ? 'Source Athlete ID'
          : record.matchType === 'exact-name'
            ? 'Exact-name match; no ID in this season'
            : record.matchType === 'conflicting-id'
              ? 'Conflicting ID; shown separately'
              : record.matchType === 'duplicate-name'
                ? 'Duplicate source name; shown separately'
                : 'Name-only source record'
      ].forEach((value, index) => {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        if (index === 0) cell.scope = 'row';
        cell.textContent = value;
        rankingRow.append(cell);
      });
      rankingHistory.append(rankingRow);

      const legRow = document.createElement('tr');
      const yearCell = document.createElement('th');
      yearCell.scope = 'row';
      yearCell.textContent = String(record.year);
      const divisionCell = document.createElement('td');
      divisionCell.textContent = record.categoryTitle.replace(/^\d{4}\s*/, '');
      const pointsCell = document.createElement('td');
      const listedLegPoints = record.legPoints.filter(leg => leg.points.trim() !== '');
      pointsCell.textContent = listedLegPoints.length
        ? listedLegPoints.map(leg => `${leg.label}: ${leg.points}`).join(' · ')
        : 'No leg points listed';
      legRow.append(yearCell, divisionCell, pointsCell);
      legHistory.append(legRow);
    });

    const achievements = document.querySelector('#athlete-achievements');
    const achievementItems = [];
    firstPlaceRecords.forEach(record => {
      achievementItems.push({
        title: 'First-place season ranking',
        detail: `${record.year} · ${record.division.label}`
      });
    });
    if (athleteProfile.seasons.length > 1) {
      achievementItems.push({
        title: 'Multiple seasons represented',
        detail: athleteProfile.seasons.join(' · ')
      });
    }
    if (bestRank !== null) {
      achievementItems.push({
        title: 'Best recorded season ranking',
        detail: `Rank #${bestRank} · ${bestRecords.map(record => `${record.year} · ${record.division.label}`).join(' · ')}`
      });
    }
    achievementItems.forEach(achievement => {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = achievement.title;
      const detail = document.createElement('span');
      detail.textContent = achievement.detail;
      item.append(title, detail);
      achievements.append(item);
    });
    if (!achievementItems.length) {
      const item = document.createElement('li');
      item.textContent = 'No supported achievement can be derived from the available ranking records.';
      achievements.append(item);
    }

    const nav = document.querySelector('.athlete-profile-nav');
    const navLinks = [...nav.querySelectorAll('a')];
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.forEach(item => item.classList.remove('active'));
        link.classList.add('active');
      });
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
        if (!visible) return;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`);
        });
      }, { rootMargin: '-20% 0px -65% 0px', threshold: [0.05, 0.25, 0.5] });
      document.querySelectorAll('#athlete-overview, #athlete-rankings, #athlete-results, #athlete-career')
        .forEach(section => observer.observe(section));
    }
  }
}
