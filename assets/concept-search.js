(function () {

  const searchWorker = new Worker('/assets/concept-search-worker.js');

  const LANGUAGES = [
    'eng',
    'ara',
    'spa',
    'swe',
    'kor',
  ];

  let el = React.createElement;

  let fieldConfig = {
    termid: {
      title: 'ID',
      view: (item) => { return el('a', {
        href: getConceptPermalink(item),
        target: '_blank',
      }, item.termid) },
    },
    term: {
      title: 'Term',
      view: (item) => { return el('a', {
        href: getConceptPermalink(item),
        target: '_blank',
      }, item.term) },
    },
    language_code: { title: 'Lang' },
    entry_status: { title: 'Validity' },
    review_decision: { title: 'Review' },
  };

  let fields = ['termid', 'language_code', 'term', 'entry_status', 'review_decision'].map((f) => {
    return { name: f, ...fieldConfig[f] };
  });

  class SearchControls extends React.Component {
    constructor(props) {
      super();

      this.handleSearchStringChange = this.handleSearchStringChange.bind(this);
      this.handleValiditySelectionChange = this.handleValiditySelectionChange.bind(this);

      this.validityCheckboxRef = React.createRef();
      this.stringInputRef = React.createRef();

      this.state = {
        valid: undefined,
        string: '',
      };
    }
    componentDidMount() {
      this._updateValidityCheckbox();
      this.stringInputRef.current.focus();
    }
    componentDidUpdate() {
      this._updateValidityCheckbox();
    }
    render() {
      var searchControls = [
        el('input', {
          key: 'search-string',
          ref: this.stringInputRef,
          className: 'search-string',
          type: 'text',
          placeholder: 'Start typing…',
          onChange: this.handleSearchStringChange}),
      ];

      if ((this.props.refineControls || []).length > 0) {
        var refineControls = [];

        if (this.props.refineControls.indexOf('validity') >= 0) {
          refineControls.push(
            el('div', { key: 'validity', className: 'validity' }, [
              el('input', {
                key: 'validity-checkbox',
                ref: this.validityCheckboxRef,
                id: 'conceptSearchValidity',
                type: 'checkbox',
                checked: this.state.valid || false,
                onChange: this.handleValiditySelectionChange}),
              el('label', {
                key: 'validity-label',
                htmlFor: 'conceptSearchValidity' }, 'valid only'),
            ]),
          )
        }

        searchControls.push(el('div', { key: 'refine', className: 'refine' }, refineControls));
      }

      return el(React.Fragment, null, searchControls);
    }

    emitSearchChange() {
      this.props.onSearchChange({
        valid: this.state.valid,
        string: this.state.string,
      });
    }

    handleSearchStringChange(evt) {
      this.setState({ string: evt.target.value }, () => { this.emitSearchChange() });
    }

    handleValiditySelectionChange(evt) {
      this.setState(({ valid, string }) => {
        if (valid == undefined) {
          return { valid: true, string };
        } else if (valid == true) {
          return { valid: false, string };
        } else {
          return { valid: undefined, string };
        }
      }, () => { this.emitSearchChange() });
    }

    _updateValidityCheckbox() {
      if (this.validityCheckboxRef.current) {
        this.validityCheckboxRef.current.indeterminate = this.state.valid === undefined;
      }
    }
  }

  class ConceptList extends React.Component {
    render() {
      return el('table', null, [

        el('thead', { key: 'thead' }, el('tr', null, this.props.fields.map((field) => {
          return el('th', { key: field.name }, field.title);
        }))),

        el('tbody', { key: 'tbody' }, this.props.items.map((item) => {
          const localizedItems = LANGUAGES.
            filter((lang) => Object.keys(item).indexOf(lang) >= 0).
            map((lang) => item[lang]);

          return [item, ...localizedItems].map((item) => {
            const isLocalized = item.hasOwnProperty('language_code');
            const conceptId = isLocalized ? item.id : item.termid;

            return el(
              'tr', {
                key: `${conceptId}-${item.language_code}`,
                className: `${isLocalized ? 'localized' : 'main'}`,
              },
              this.props.fields.map((field) => {
                const view = field.view;
                const defaultView = (item) => { return item[field.name]; };
                return el(
                  'td',
                  { key: `${conceptId}-${item.language_code}-${field.name}` },
                  (view || defaultView)(item));
              })
            );
          });
        }).reduce((a, b) => a.concat(b), [])),

      ]);
    }
  }

  class ConceptBrowser extends React.Component {
    constructor(props) {
      super();

      this.state = {
        items: [],
        searchQuery: {},  // string, (in future) valid
        expanded: false,
      };

      this.handleSearchQuery = this.handleSearchQuery.bind(this);
      this.handleToggleBrowser = this.handleToggleBrowser.bind(this);
    }

    componentDidMount() {
      searchWorker.onmessage = (msg) => {
        this.setState({ items: msg.data });
      };
    }

    componentWillUnmount() {
      searchWorker.onmessage = undefined;
    }

    render() {
      var headerContents = [];
      var searchString = this.state.searchQuery.string;

      if (searchString && searchString.length > 1) {
        let buttonLabel = this.state.expanded ? '×' : '+';
        headerContents.push(
          el('button', {
            className: 'toggle',
            ref: this.toggleSwitchRef,
            onClick: this.handleToggleBrowser,
          }, buttonLabel)
        );
      }
      headerContents.push(el('span', null, 'Find a concept'));

      var els = [
        el('h2', { key: 'section-title', className: 'section-title' },
          headerContents
        ),
        el('div', { key: 'search-controls', className: 'search-controls' },
          el(SearchControls, {
            onSearchChange: this.handleSearchQuery,
            refineControls: [],
          })
        ),
      ];

      if (this.state.expanded) {
        els.push(el('div', { key: 'search-results', className: 'search-results' },
          el(ConceptList, { items: this.state.items, fields })));
      }

      return el(React.Fragment, null, els);
    }

    handleSearchQuery(query) {
      if (query.string.length > 1) {
        this.setState({ searchQuery: query, expanded: true });
        updateBodyClass({ searchQuery: query, expanded: true });
        window.setTimeout(() => { searchWorker.postMessage(query) }, 100);
      } else {
        this.setState({ searchQuery: query, expanded: false });
        updateBodyClass({ searchQuery: query, expanded: false });
      }
    }

    handleToggleBrowser() {
      this.setState((state) => {
        state.expanded = !state.expanded;

        if (state.expanded) {
          updateBodyClass({ expanded: true });
        } else {
          updateBodyClass({ expanded: false });
        }
        return state;
      });
    }
  }

  ReactDOM.render(el(ConceptBrowser, null), document.querySelector('.browse-concepts'))

  function getConceptPermalink(concept) {
    return `/concepts/${concept.termid}/`;
  }

  function updateBodyClass({ searchQuery, expanded }) {
    if (searchQuery) {
      if (searchQuery.string.length > 1) {
        document.querySelector('body').classList.add('browser-expandable');
      } else {
        document.querySelector('body').classList.remove('browser-expandable');
      }
    }

    if (expanded === true) {
      document.querySelector('body').classList.add('browser-expanded');
    } else if (expanded === false) {
      document.querySelector('body').classList.remove('browser-expanded');
    }
  }

}());
