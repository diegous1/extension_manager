document.addEventListener("DOMContentLoaded", function() {

  var SearchViewModel = function() {
    var self = this;
    self.q = ko.observable("");

    // TODO: Add more search control here.
  };

  var SwitchViewModel = function(exts, profiles, opts) {
    var self = this;

    var init = [];

    self.exts = exts;
    self.profiles = profiles;
    self.opts = opts;
    self.toggled = ko.observableArray().extend({persistable: "toggled"});

    self.any = ko.computed(function() {
      return self.toggled().length > 0;
    });

    self.toggleIcon = ko.pureComputed(function() {
      return (self.any()) ? 'toggle-left' : 'toggle-right'
    });

    var disableFilterFn = function(item) {
      // Filter out Always On extensions when disabling, if option is set.
      if(!self.opts.keepAlwaysOn()) return true;
      return !_(self.profiles.always_on().items()).contains(item.id());
    };

    self.flip = function() {
      if(self.any()) {
        // Re-enable
        _(self.toggled()).each(function(id) {
          // Old disabled extensions may be removed
          try{ self.exts.find(id).enable();} catch(e) {};
        });
        self.toggled([]);
      } else {
        // Disable
        self.toggled(self.exts.enabled.pluck());
        self.exts.enabled.disable(disableFilterFn);
      };
    };

  };

  var ExtensityViewModel = function() {
    var self = this;

    self.profiles = new ProfileCollectionModel();
    self.exts = new ExtensionCollectionModel();
    self.opts = new OptionsCollection();
    self.dismissals = new DismissalsCollection();
    self.switch = new SwitchViewModel(self.exts, self.profiles, self.opts);
    self.search = new SearchViewModel();
    self.activeProfile = ko.observable().extend({persistable: "activeProfile"});
    self.activeTab = ko.observable('extensions');
    
    // Auto-select first available tab
    ko.computed(function() {
      if (self.opts.groupApps()) {
        if (self.listedExtensions.any() && (self.activeTab() !== 'extensions' && self.activeTab() !== 'apps' && self.activeTab() !== 'favorites')) {
          self.activeTab('extensions');
        } else if (!self.listedExtensions.any() && self.listedApps.any() && self.activeTab() === 'extensions') {
          self.activeTab('apps');
        } else if (!self.listedExtensions.any() && !self.listedApps.any() && self.listedFavorites.any() && self.activeTab() !== 'favorites') {
          self.activeTab('favorites');
        }
      }
    });

    var filterFn = function(i) {
      // Filtering function for search box
      if(!self.opts.searchBox()) return true;
      if(!self.search.q()) return true;
      return i.name().toUpperCase().indexOf(self.search.q().toUpperCase()) !== -1;
    };

    var filterProfileFn = function(i) {
      if(!i.reserved()) return true;
      return self.opts.showReserved() && i.hasItems();
    }

    var filterFavoriteFn = function(i) {
      return (self.profiles.favorites().contains(i));
    }

    var nameSortFn = function(i) {
      return i.name().toUpperCase();
    };

    var statusSortFn = function(i) {
      return self.opts.enabledFirst() && !i.status();
    };

    self.openChromeExtensions = function() {
      openTab("chrome://extensions");
    };

    self.launchApp = function(app) {
      if (typeof chrome.management.launchApp === "function") {
        chrome.management.launchApp(app.id());
      }
    };

    self.launchOptions = function(ext) {
      chrome.tabs.create({url: ext.optionsUrl(), active: true});
    };

    self.listedExtensions = ko.computed(function() {
      // Sorted/Filtered list of extensions
      return _(self.exts.extensions()).chain()
        .filter(filterFn)
        .sortBy(nameSortFn)
        .sortBy(statusSortFn)
        .value()
    }).extend({countable: null});

    self.listedApps = ko.computed(function() {
      // Sorted/Filtered list of apps
      return _(self.exts.apps())
        .filter(filterFn);
    }).extend({countable: null});

    self.listedItems = ko.computed(function() {
      // Sorted/Filtered list of all items
      return _(self.exts.items())
        .filter(filterFn);
    }).extend({countable: null});

    self.listedProfiles = ko.computed(function() {
      return _(self.profiles.items())
        .filter(filterProfileFn);
    }).extend({countable: null});

    self.listedFavorites = ko.computed(function() {
      return _(self.exts.extensions()).chain()
        .filter(filterFavoriteFn)
        .filter(filterFn)
        .sortBy(nameSortFn)
        .sortBy(statusSortFn)
        .value();
    }).extend({countable: null});

    self.emptyItems = ko.pureComputed(function() {
      return self.listedApps.none() && self.listedExtensions.none();
    });

    self.setProfile = function(p) {
      self.activeProfile(p.name());
      // Profile items, plus always-on items
      var ids = _.union(p.items(), self.profiles.always_on().items());
      var to_enable = _.intersection(self.exts.disabled.pluck(),ids);
      var to_disable = _.difference(self.exts.enabled.pluck(), ids);
      _(to_enable).each(function(id) { self.exts.find(id).enable() });
      _(to_disable).each(function(id) { self.exts.find(id).disable() });
    };

    self.unsetProfile = function() {
      self.activeProfile(undefined);
    };

    self.toggleExtension = function(e, event) {
      if (event) {
        event.stopPropagation();
      }
      e.toggle();
      self.unsetProfile();
    }

    // Private helper functions
    var openTab = function (url) {
      chrome.tabs.create({url: url});
      close();
    };

    var close = function() {
      window.close();
    };

    // View helpers
    var visitedProfiles = ko.computed(function() {
      return (self.dismissals.dismissed("profile_page_viewed") || self.profiles.any());
    });

  };

  _.defer(function() {
    vm = new ExtensityViewModel();
    ko.bindingProvider.instance = new ko.secureBindingsProvider({});
    ko.applyBindings(vm, document.body);
    
    // Initialize Lucide icons after Knockout bindings
    function initLucideIcons() {
      try {
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
          lucide.createIcons();
        } else {
          console.warn('Lucide Icons não está disponível');
        }
      } catch (e) {
        console.error('Erro ao inicializar Lucide Icons:', e);
      }
    }
    
    // Wait a bit for DOM to be ready, then initialize
    setTimeout(function() {
      initLucideIcons();
    }, 100);
    
    // Also initialize after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initLucideIcons, 50);
      });
    } else {
      // DOM already ready
      setTimeout(initLucideIcons, 50);
    }
    
    // Re-initialize icons when templates are rendered
    var observer = new MutationObserver(function(mutations) {
      var hasNewIcons = false;
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          hasNewIcons = true;
        }
      });
      if (hasNewIcons) {
        setTimeout(initLucideIcons, 10);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });

  // Workaround for Chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=307912
  window.setTimeout(function() { document.getElementById('workaround-307912').style.display = 'block'; }, 0);
});
