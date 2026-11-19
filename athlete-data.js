(() => {
  const rankingYears = window.upsaRankings;
  if (!Array.isArray(rankingYears)) {
    throw new Error('UPSA rankings data must load before athlete data.');
  }

  const profiles = new Map();
  const profileKeyByRow = new WeakMap();
  const rawRows = [];
  const idsByYearAndId = new Map();
  const idsByName = new Map();
  const duplicateNames = new Set();
  // Maintain verified athlete photographs here. Athlete IDs are the preferred key.
  // Add a profilePhoto and coverPhoto separately when genuine separate images are available.
  const athletePhotoRecordsById = new Map([
    ['25253', {
      coverPhoto: 'https://upsa.ph/wp-content/uploads/2026/09/PHI_ath_Nilbie_Blancada_ath_ph_Jersson_Barboza_ph_00-scaled.jpg',
      profilePhoto: 'https://upsa.ph/wp-content/uploads/2026/09/PHI_ath_Nilbie_Blancada_ath_ph_Jersson_Barboza_ph_00-scaled.jpg'
    }]
  ]);
  const scriptUrl = document.currentScript ? document.currentScript.src : new URL('athlete-data.js', document.baseURI).href;

  const normalizeName = name => name.trim().replace(/\s+/g, ' ').normalize('NFC').toLocaleLowerCase();
  const slugify = value => value
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';

  const getDivision = title => {
    const sourceLabel = title.replace(/^\d{4}\s*/, '').replace(/\s+/g, ' ').trim();
    const normalizedLabel = sourceLabel
      .replace(/^mens\b/i, "Men's")
      .replace(/^womens\b/i, "Women's")
      .replace(/\s+open\b/i, '');
    const lowerLabel = normalizedLabel.toLocaleLowerCase();
    const divisionLabels = {
      "men's shortboard": { key: 'mens-shortboard', label: "Men's Shortboard" },
      "women's shortboard": { key: 'womens-shortboard', label: "Women's Shortboard" },
      "men's longboard": { key: 'mens-longboard', label: "Men's Longboard" },
      "women's longboard": { key: 'womens-longboard', label: "Women's Longboard" },
      'junior boys': { key: 'junior-boys', label: 'Junior Boys' },
      'junior girls': { key: 'junior-girls', label: 'Junior Girls' }
    };
    return divisionLabels[lowerLabel] || {
      key: slugify(normalizedLabel),
      label: normalizedLabel
    };
  };

  rankingYears.forEach(year => {
    year.categories.forEach((category, categoryIndex) => {
      const nameIndex = category.headers.findIndex(header => /^name$/i.test(header));
      const rankIndex = category.headers.findIndex(header => /^rank$/i.test(header));
      const idIndex = category.headers.findIndex(header => /^athlete\s*id$/i.test(header));
      const totalPointsIndex = category.headers.findIndex(header => /^total points/i.test(header));
      const legIndexes = category.headers
        .map((header, index) => ({ header, index }))
        .filter(item => /^leg\s+\d+$/i.test(item.header));

      if (nameIndex < 0 || rankIndex < 0 || totalPointsIndex < 0) {
        throw new Error(`Unexpected ranking columns in ${category.title}.`);
      }

      const division = getDivision(category.title);
      const nameCounts = new Map();

      category.rows.forEach(row => {
        const name = String(row[nameIndex] ?? '').trim();
        const nameKey = normalizeName(name);
        nameCounts.set(nameKey, (nameCounts.get(nameKey) || 0) + 1);
      });

      category.rows.forEach((row, rowIndex) => {
        if (row.length !== category.headers.length) {
          throw new Error(`Ranking row width mismatch in ${category.title}, row ${rowIndex + 1}.`);
        }

        const name = String(row[nameIndex]).trim();
        const nameKey = normalizeName(name);
        const athleteId = idIndex < 0 || row[idIndex] === '' ? null : String(row[idIndex]).trim();
        const record = {
          year: year.year,
          categoryTitle: category.title,
          categoryIndex,
          rowIndex,
          sourceName: name,
          nameKey,
          athleteId,
          duplicateNameInCategory: nameCounts.get(nameKey) > 1,
          division,
          rank: String(row[rankIndex]),
          totalPoints: String(row[totalPointsIndex]),
          totalPointsLabel: category.headers[totalPointsIndex],
          legPoints: legIndexes.map(item => ({
            label: item.header,
            points: String(row[item.index])
          })),
          sourceRow: row
        };
        rawRows.push(record);

        if (athleteId) {
          const yearIdKey = `${year.year}:${athleteId}`;
          if (!idsByYearAndId.has(yearIdKey)) idsByYearAndId.set(yearIdKey, new Set());
          idsByYearAndId.get(yearIdKey).add(nameKey);

          if (!idsByName.has(nameKey)) idsByName.set(nameKey, new Set());
          idsByName.get(nameKey).add(athleteId);
        }

        if (record.duplicateNameInCategory) {
          duplicateNames.add(`${year.year}:${categoryIndex}:${nameKey}`);
        }
      });
    });
  });

  const conflictingIds = new Set();
  idsByYearAndId.forEach((names, yearIdKey) => {
    if (names.size > 1) conflictingIds.add(yearIdKey.slice(yearIdKey.indexOf(':') + 1));
  });

  rawRows.forEach(record => {
    let profileKey;
    let matchType;

    if (record.athleteId && !conflictingIds.has(record.athleteId)) {
      profileKey = `id:${record.athleteId}`;
      matchType = 'source-id';
    } else if (record.athleteId) {
      profileKey = `row:${record.year}:${slugify(record.categoryTitle)}:${record.rowIndex}`;
      matchType = 'conflicting-id';
    } else if (duplicateNames.has(`${record.year}:${record.categoryIndex}:${record.nameKey}`)) {
      profileKey = `row:${record.year}:${slugify(record.categoryTitle)}:${record.rowIndex}`;
      matchType = 'duplicate-name';
    } else {
      const candidateIds = idsByName.get(record.nameKey);
      if (candidateIds && candidateIds.size === 1 && !conflictingIds.has([...candidateIds][0])) {
        profileKey = `id:${[...candidateIds][0]}`;
        matchType = 'exact-name';
      } else {
        profileKey = `name:${record.nameKey}`;
        matchType = 'exact-name-provisional';
      }
    }

    record.profileKey = profileKey;
    record.matchType = matchType;
    profileKeyByRow.set(record.sourceRow, profileKey);

    if (!profiles.has(profileKey)) {
      const isConflictingId = matchType === 'conflicting-id';
      const isDuplicateName = matchType === 'duplicate-name';
      profiles.set(profileKey, {
        key: profileKey,
        name: record.sourceName,
        athleteId: matchType === 'source-id' || matchType === 'exact-name' ? record.athleteId || profileKey.slice(3) : null,
        sourceAthleteId: isConflictingId ? record.athleteId : null,
        identityConflict: isConflictingId,
        duplicateSourceName: isDuplicateName,
        hasProvisionalNameMatch: false,
        rankings: [],
        coverPhoto: null,
        profilePhoto: null,
        nationality: null,
        surfClub: null,
        hometown: null,
        photoRecords: []
      });
    }

    const profile = profiles.get(profileKey);
    profile.rankings.push(record);
    if (matchType === 'exact-name') profile.hasProvisionalNameMatch = true;
    if (record.year > profile.latestNameYear || profile.latestNameYear === undefined) {
      profile.name = record.sourceName;
      profile.latestNameYear = record.year;
    }
    if (profile.athleteId && athletePhotoRecordsById.has(profile.athleteId)) {
      const photoRecord = athletePhotoRecordsById.get(profile.athleteId);
      profile.coverPhoto = photoRecord.coverPhoto || null;
      profile.profilePhoto = photoRecord.profilePhoto || photoRecord.coverPhoto || null;
      profile.nationality = photoRecord.nationality || null;
      profile.surfClub = photoRecord.surfClub || null;
      profile.hometown = photoRecord.hometown || null;
      profile.photoRecords = [photoRecord];
    }
  });

  profiles.forEach(profile => {
    profile.rankings.sort((first, second) =>
      second.year - first.year
      || Number(first.rank) - Number(second.rank)
      || first.categoryTitle.localeCompare(second.categoryTitle)
    );
    profile.divisions = [...new Map(profile.rankings.map(record => [record.division.key, record.division])).values()]
      .sort((first, second) => first.label.localeCompare(second.label));
    profile.seasons = [...new Set(profile.rankings.map(record => record.year))].sort((first, second) => second - first);
    profile.bestRank = Math.min(...profile.rankings.map(record => Number(record.rank)).filter(Number.isFinite));
    profile.highlights = profile.rankings.filter(record => Number(record.rank) === 1);
    profile.hasProvisionalNameMatch = profile.rankings.some(record => record.matchType === 'exact-name');
    profile.nameVariants = [...new Set(profile.rankings.map(record => record.sourceName))];
    delete profile.latestNameYear;
  });

  const normalizedProfiles = [...profiles.values()].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })
    || first.key.localeCompare(second.key)
  );

  window.upsaAthleteData = {
    getProfiles() {
      return normalizedProfiles;
    },
    getProfile(profileKey) {
      return profiles.get(profileKey) || null;
    },
    getProfileKeyForRankingRow(row) {
      return profileKeyByRow.get(row) || null;
    },
    getProfileHref(profileKey) {
      const profileUrl = new URL('athlete-profile.html', scriptUrl);
      profileUrl.searchParams.set('athlete', profileKey);
      return profileUrl.href;
    }
  };
})();
