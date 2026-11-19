const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.desktop-nav');
const brandLink = document.querySelector('.site-header .brand');
const brandUrl = brandLink
  ? new URL(brandLink.getAttribute('href'), document.baseURI)
  : new URL('index.html', document.baseURI);
const siteRoot = new URL('.', brandUrl);
const athleteDirectoryUrl = new URL('athletes.html', siteRoot);
let athleteNavigationLink = navigation.querySelector('[data-athletes-nav]');

if (!athleteNavigationLink) {
  athleteNavigationLink = document.createElement('a');
  athleteNavigationLink.dataset.athletesNav = '';
  athleteNavigationLink.href = athleteDirectoryUrl.href;
  athleteNavigationLink.textContent = 'Athletes';
  const eventsLink = Array.from(navigation.querySelectorAll('a'))
    .find(link => link.textContent.trim() === 'Events');
  if (eventsLink) {
    eventsLink.insertAdjacentElement('afterend', athleteNavigationLink);
  } else {
    navigation.append(athleteNavigationLink);
  }
}

const currentPath = window.location.pathname.replace(/\/+$/, '');
const profilePath = new URL('athlete-profile.html', siteRoot).pathname.replace(/\/+$/, '');
if (currentPath === athleteDirectoryUrl.pathname.replace(/\/+$/, '') || currentPath === profilePath) {
  athleteNavigationLink.classList.add('active');
}
if (currentPath === athleteDirectoryUrl.pathname.replace(/\/+$/, '')) {
  athleteNavigationLink.setAttribute('aria-current', 'page');
}

menuButton.addEventListener('click', () => {
  const open = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.querySelectorAll('.nav-dropdown').forEach(dropdown => dropdown.classList.remove('expanded'));
  navigation.querySelectorAll('.nav-dropdown > a').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
});

navigation.querySelectorAll('.nav-dropdown > a').forEach(link => {
  link.addEventListener('click', event => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      event.preventDefault();
      const open = link.parentElement.classList.toggle('expanded');
      link.setAttribute('aria-expanded', String(open));
    }
  });
});

navigation.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    if (link.parentElement.classList.contains('nav-dropdown')) return;
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.querySelectorAll('.nav-dropdown').forEach(dropdown => dropdown.classList.remove('expanded'));
    navigation.querySelectorAll('.nav-dropdown > a').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
  });
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

const eventForm = document.querySelector('#event-search-form');
const eventGrid = document.querySelector('#event-card-grid');
const eventCards = Array.from(document.querySelectorAll('.event-listing'));

if (eventForm && eventGrid) {
  const keyword = document.querySelector('#event-keyword');
  const location = document.querySelector('#event-location');
  const eventType = document.querySelector('#event-type');
  const dateFrom = document.querySelector('#event-from');
  const dateTo = document.querySelector('#event-to');
  const resultCount = document.querySelector('#event-result-count');
  const noResults = document.querySelector('#event-no-results');
  const filterToggle = document.querySelector('#event-filter-toggle');
  const extraFilters = document.querySelector('#event-extra-filters');

  const filterEvents = () => {
    const searchTerm = keyword.value.trim().toLowerCase();
    const locationTerm = location.value.trim().toLowerCase();
    const selectedType = eventType.value;
    let visibleCount = 0;

    eventCards.forEach(card => {
      const start = card.dataset.start;
      const end = card.dataset.end || start;
      const matches = card.dataset.title.toLowerCase().includes(searchTerm)
        && card.dataset.location.toLowerCase().includes(locationTerm)
        && (!selectedType || card.dataset.type === selectedType)
        && (!dateFrom.value || end >= dateFrom.value)
        && (!dateTo.value || start <= dateTo.value);

      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    resultCount.textContent = `${visibleCount} ${visibleCount === 1 ? 'event' : 'events'}`;
    noResults.hidden = visibleCount > 0;
  };

  eventForm.addEventListener('submit', event => {
    event.preventDefault();
    filterEvents();
  });

  filterToggle.addEventListener('click', () => {
    const open = filterToggle.getAttribute('aria-expanded') !== 'true';
    filterToggle.setAttribute('aria-expanded', String(open));
    filterToggle.setAttribute('aria-label', open ? 'Hide event filters' : 'Show event filters');
    extraFilters.hidden = !open;
  });

  document.querySelectorAll('[data-event-view]').forEach(button => {
    button.addEventListener('click', () => {
      const listView = button.dataset.eventView === 'list';
      eventGrid.classList.toggle('list-view', listView);
      document.querySelectorAll('[data-event-view]').forEach(viewButton => {
        const selected = viewButton === button;
        viewButton.classList.toggle('selected', selected);
        viewButton.setAttribute('aria-pressed', String(selected));
      });
    });
  });
}

const membershipFlow = document.querySelector('#membership-flow');

if (membershipFlow) {
  const selectedPlan = document.querySelector('#membership-selected-plan');
  const dialog = membershipFlow.querySelector('[role="dialog"]');
  const questionStep = document.querySelector('#membership-question-step');
  const yesStep = document.querySelector('#membership-yes-step');
  const noStep = document.querySelector('#membership-no-step');
  let chosenPlan = '';
  let opener = null;

  const openMembershipFlow = trigger => {
    opener = trigger;
    membershipFlow.hidden = false;
    document.body.classList.add('membership-modal-open');
    questionStep.hidden = false;
    yesStep.hidden = true;
    noStep.hidden = true;
    dialog.focus();
  };

  const closeMembershipFlow = () => {
    membershipFlow.hidden = true;
    document.body.classList.remove('membership-modal-open');
    if (opener) opener.focus();
  };

  if (window.location.hash === '#membership-flow') {
    selectedPlan.textContent = 'Choose whether you competed on the 2025 Pilipinas Surfing National Tour.';
    openMembershipFlow(null);
  }

  document.querySelectorAll('a[href="#membership-flow"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      chosenPlan = link.dataset.membershipPlan || '';
      selectedPlan.textContent = chosenPlan
        ? `${chosenPlan} selected. Did you compete in any leg of the 2025 Pilipinas Surfing National Tour?`
        : 'Choose whether you competed on the 2025 Pilipinas Surfing National Tour.';
      if (link.dataset.membershipStart === 'new') {
        selectedPlan.textContent = 'New member registration selected. Did you compete in any leg of the 2025 Pilipinas Surfing National Tour?';
      }
      openMembershipFlow(link);
    });
  });

  membershipFlow.querySelectorAll('[data-membership-close]').forEach(control => {
    control.addEventListener('click', closeMembershipFlow);
  });

  document.addEventListener('keydown', event => {
    if (membershipFlow.hidden) return;
    if (event.key === 'Escape') {
      closeMembershipFlow();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled])')]
        .filter(element => !element.closest('[hidden]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  membershipFlow.querySelectorAll('[data-membership-answer]').forEach(button => {
    button.addEventListener('click', () => {
      const competed = button.dataset.membershipAnswer === 'yes';
      questionStep.hidden = true;
      yesStep.hidden = !competed;
      noStep.hidden = competed;
      const participation = competed ? 'You competed in the 2025 tour.' : 'You did not compete in the 2025 tour.';
      selectedPlan.textContent = chosenPlan ? `${chosenPlan} selected. ${participation}` : participation;
      (competed ? yesStep : noStep).querySelector('h3').focus();
    });
  });

  membershipFlow.querySelectorAll('[data-membership-back]').forEach(button => {
    button.addEventListener('click', () => {
      questionStep.hidden = false;
      yesStep.hidden = true;
      noStep.hidden = true;
      questionStep.querySelector('h3').focus();
    });
  });
}
