'use strict';

/**
 * @ngdoc overview
 * @name stockDogApp
 * @description
 * # stockDogApp
 *
 * Main module of the application.
 */
angular
  .module('stockDogApp', [
    'ngAnimate',
    'ngCookies',
    'ngResource',
    'ngRoute',
    'ngSanitize',
    'ngTouch',
    'mgcrea.ngStrap',
    'googlechart'
  ])
  .config(["$routeProvider", function ($routeProvider) {
    $routeProvider
      .when('/dashboard', {
        templateUrl: 'views/dashboard.html',
        controller: 'DashboardCtrl'
      })
      .when('/watchlist/:listId', {
        templateUrl: 'views/watchlist.html',
        controller: 'WatchlistCtrl'
      })
      .otherwise({
        redirectTo: '/dashboard'
      });
  }]);
'use strict';

angular.module('stockDogApp')
  .service('WatchlistService', function WatchlistService() {
    // Augment Stocks with additional helper functions
    var StockModel = {
      save: function () {
        var watchlist = findById(this.listId);
        watchlist.recalculate();
        saveModel();
      }
    };

    // Augment Watchlists with additional helper functions
    var WatchlistModel = {
      addStock: function (stock) {
        var existingStock = _.find(this.stocks, function (s) {
          return s.company.symbol === stock.company.symbol;
        });
        if (existingStock) {
          existingStock.shares += stock.shares;
        } else {
          _.extend(stock, StockModel);
          this.stocks.push(stock);
        }
        this.recalculate();
        saveModel();
      },
      removeStock: function (stock) {
        _.remove(this.stocks, function (s) {
          return s.company.symbol === stock.company.symbol;
        });
        this.recalculate();
        saveModel();
      },
      recalculate: function () {
        var calcs = _.reduce(this.stocks, function (calcs, stock) {
          calcs.shares += stock.shares;
          calcs.marketValue += stock.marketValue;
          calcs.dayChange += stock.dayChange;
          return calcs;
        }, { shares: 0, marketValue: 0, dayChange: 0 });

        this.shares = calcs.shares;
        this.marketValue = calcs.marketValue;
        this.dayChange = calcs.dayChange;
      }
    };

    // Helper: Load watchlists from localStorage
    var loadModel = function () {
      var model = {
        watchlists: localStorage['StockDog.watchlists'] ?
          JSON.parse(localStorage['StockDog.watchlists']) : [],
        nextId: localStorage['StockDog.nextId'] ?
          parseInt(localStorage['StockDog.nextId']) : 0
      };
      _.each(model.watchlists, function (watchlist) {
        _.extend(watchlist, WatchlistModel);
        _.each(watchlist.stocks, function (stock) {
          _.extend(stock, StockModel);
        });
      });
      return model;
    };

    // Helper: Save watchlists to localStorage
    var saveModel = function () {
      localStorage['StockDog.watchlists'] = JSON.stringify(Model.watchlists);
      localStorage['StockDog.nextId'] = Model.nextId;
    };

    // Helper: Use lodash to find a watchlist with given ID
    var findById = function (listId) {
      return _.find(Model.watchlists, function (watchlist) {
        return watchlist.id === parseInt(listId);
      });
    };

    // Return all watchlists or find by given ID
    this.query = function (listId) {
      if (listId) {
        return findById(listId);
      } else {
        return Model.watchlists;
      }
    };

    // Save a new watchlist to watchlists model
    this.save = function (watchlist) {
      watchlist.id = Model.nextId++;
      watchlist.stocks = [];
      _.extend(watchlist, WatchlistModel);
      Model.watchlists.push(watchlist);
      saveModel();
    };

    // Remove given watchlist from watchlists model
    this.remove = function (watchlist) {
      _.remove(Model.watchlists, function (list) {
        return list.id === watchlist.id;
      });
      saveModel();
    };

    // Initialize Model for this singleton service
    var Model = loadModel();
  });
'use strict';

angular.module('stockDogApp')
  // Register directive and inject dependencies
  .directive('stkWatchlistPanel',
    ["$location", "$modal", "$routeParams", "WatchlistService", function ($location, $modal, $routeParams, WatchlistService) {
    return {
      templateUrl: 'views/templates/watchlist-panel.html',
      restrict: 'E',
      scope: {},
      link: function ($scope) {
        // Initialize variables
        $scope.watchlist = {};
        $scope.currentList = $routeParams.listId;
        var addListModal = $modal({
          scope: $scope,
          template: 'views/templates/addlist-modal.html',
          show: false
        });

        // Bind model from service to this scope
        $scope.watchlists = WatchlistService.query();

        // Display addlist modal
        $scope.showModal = function () {
          addListModal.$promise.then(addListModal.show);
        };

        // Create a new list from fields in modal
        $scope.createList = function () {
          WatchlistService.save($scope.watchlist);
          addListModal.hide();
          $scope.watchlist = {};
        };

        // Delete desired list and redirect to home
        $scope.deleteList = function (list) {
          WatchlistService.remove(list);
          $location.path('/');
        };

        // Send users to desired watchlist view
        $scope.gotoList = function (listId) {
          $location.path('watchlist/' + listId);
        };
      }
    };
  }]);
'use strict';

angular.module('stockDogApp')
  .controller('DashboardCtrl', ["$scope", "WatchlistService", "QuoteService", function ($scope, WatchlistService, QuoteService) {
    // Initializations
    var unregisterHandlers = [];
    $scope.watchlists = WatchlistService.query();
    $scope.cssStyle = 'height:300px;';
    var formatters = {
      number: [
        {
          columnNum: 1,
          prefix: '$'
        }
      ]
    };

    // Helper: Update chart objects
    var updateCharts = function () {
      // Donut chart
      var donutChart = {
        type: 'PieChart',
        displayed: true,
        data: [['Watchlist', 'Market Value']],
        options: {
          title: 'Market Value by Watchlist',
          legend: 'none',
          pieHole: 0.4
        },
        formatters: formatters
      };
      // Column chart
      var columnChart = {
        type: 'ColumnChart',
        displayed: true,
        data: [['Watchlist', 'Change', { role: 'style' }]],
        options: {
          title: 'Day Change by Watchlist',
          legend: 'none',
          animation: {
            duration: 1500,
            easing: 'linear'
          }
        },
        formatters: formatters
      };

      // Push data onto both chart objects
      _.each($scope.watchlists, function (watchlist) {
        donutChart.data.push([watchlist.name, watchlist.marketValue]);
        columnChart.data.push([watchlist.name, watchlist.dayChange,
          watchlist.dayChange < 0 ? 'Red' : 'Green']);
      });
      $scope.donutChart = donutChart;
      $scope.columnChart = columnChart;
    };

    // Helper function for reseting controller state
    var reset = function () {
      // Clear QuoteService before registering new stocks
      QuoteService.clear();
      _.each($scope.watchlists, function (watchlist) {
        _.each(watchlist.stocks, function (stock) {
          QuoteService.register(stock);
        });
      });

      // Unregister existing $watch listeners before creating new ones
      _.each(unregisterHandlers, function(unregister) {
        unregister();
      });
      _.each($scope.watchlists, function (watchlist) {
        var unregister = $scope.$watch(function () {
          return watchlist.marketValue;
        }, function () {
          recalculate();
        });
        unregisterHandlers.push(unregister);
      });
    };

    // Compute the new total MarketValue and DayChange
    var recalculate = function () {
      $scope.marketValue = 0;
      $scope.dayChange = 0;
      _.each($scope.watchlists, function (watchlist) {
        $scope.marketValue += watchlist.marketValue ?
          watchlist.marketValue : 0;
        $scope.dayChange += watchlist.dayChange ?
          watchlist.dayChange : 0;
      });
      updateCharts();
    };

    // Watch for changes to watchlists. Notice that
    // we are NOT deep-watching the entire object (bad)
    // but merely the length, which is enough to decide
    // we need to reset this controller;
    $scope.$watch('watchlists.length', function () {
      reset();
    });
  }]);
'use strict';

/**
 * @ngdoc function
 * @name stockDogApp.controller:WatchlistCtrl
 * @description
 * # WatchlistCtrl
 * Controller of the stockDogApp
 */
angular.module('stockDogApp')
  .controller('WatchlistCtrl', ["$scope", "$routeParams", "$modal", "WatchlistService", "CompanyService", function ($scope, $routeParams, $modal, WatchlistService, CompanyService) {
    // Initializations
    $scope.companies = CompanyService.query();
    $scope.watchlist = WatchlistService.query($routeParams.listId);
    $scope.stocks = $scope.watchlist.stocks;
    $scope.newStock = {};
    var addStockModal = $modal({
      scope: $scope,
      template: 'views/templates/addstock-modal.html',
      show: false
    });

    $scope.showStockModal = function () {
      addStockModal.$promise.then(addStockModal.show);
    };

    $scope.addStock = function () {
      $scope.watchlist.addStock({
        listId: $routeParams.listId,
        company: $scope.newStock.company,
        shares: $scope.newStock.shares
      });
      addStockModal.hide();
      $scope.newStock = {};
    };
  }]);
'use strict';

angular.module('stockDogApp')
  .controller('MainCtrl', ["$scope", "$location", "WatchlistService", function ($scope, $location, WatchlistService) {
    // [1] Populate watchlists for dynamic nav links
    $scope.watchlists = WatchlistService.query();

    // [2] Using the $location.path() function as a $watch expression
    $scope.$watch(function () {
      //return $location.path();
    }, function (path) {
      _.contains = _.includes;
      if (_.contains(path, 'watchlist')) {
          $scope.activeView = 'watchlist';
        } else {
          $scope.activeView = 'dashboard';
        }
      });
  }]);
'use strict';

angular.module('stockDogApp')
  .service('CompanyService', ["$resource", function CompanyService($resource) {
    return $resource('companies.json');
  }]);
'use strict';

angular.module('stockDogApp')
  .service('QuoteService', ["$http", "$interval", function ($http, $interval) {
    var stocks = [];
    var BASE = 'http://query.yahooapis.com/v1/public/yql';

    // Handles updating stock model with appropriate data from quote
    var update = function (quotes) {
      console.log(quotes);
      if (quotes.length === stocks.length) {
        _.each(quotes, function (quote, idx) {
          var stock = stocks[idx];
          stock.lastPrice = parseFloat(quote.LastTradePriceOnly);
          stock.change = quote.Change;
          stock.percentChange = quote.ChangeinPercent;
          stock.marketValue = stock.shares * stock.lastPrice;
          stock.dayChange = stock.shares * parseFloat(stock.change);
          stock.save();
        });
      }
    };

    // Helper functions for managing which stocks to pull quotes for
    this.register = function (stock) {
      stocks.push(stock);
    };
    this.deregister = function (stock) {
      _.remove(stocks, stock);
    };
    this.clear = function () {
      stocks = [];
    };

    // Main processing function for communicating with Yahoo Finance API
    this.fetch = function () {
      var symbols = _.reduce(stocks, function (symbols, stock) {
        symbols.push(stock.company.symbol);
        return symbols;
      }, []);
      var query = encodeURIComponent('select * from yahoo.finance.quotes ' +
        'where symbol in (\'' + symbols.join(',') + '\')');
      var url = BASE + '?' + 'q=' + query + '&format=json&diagnostics=true' +
        '&env=http://datatables.org/alltables.env';
      $http.jsonp(url + '&callback=JSON_CALLBACK')
        .success(function (data) {
          if (data.query.count) {
            var quotes = data.query.count > 1 ?
              data.query.results.quote : [data.query.results.quote];
            update(quotes);
          }
        })
        .error(function (data) {
          console.log(data);
        });
    };

    // Used to fetch new quote data every 5 seconds
    $interval(this.fetch, 5000);   
  }]);
'use strict';

angular.module('stockDogApp')
  .directive('stkStockTable', function () {
    return {
      templateUrl: 'views/templates/stock-table.html',
      restrict: 'E',
      scope: {
        watchlist: '='
      },
      controller: ["$scope", function ($scope) {
        var rows = [];

        $scope.$watch('showPercent', function (showPercent) {
          if (showPercent) {
            _.each(rows, function (row) {
              row.showPercent = showPercent;
            });
          }
        });

        this.addRow = function (row) {
          rows.push(row);
        };

        this.removeRow = function (row) {
          _.remove(rows, row);
        };
      }],
      link: function ($scope) {
        $scope.showPercent = false;
        $scope.removeStock = function (stock) {
          $scope.watchlist.removeStock(stock);
        };
      }
    };
  });
'use strict';

angular.module('stockDogApp')
  .directive('stkStockRow', ["$timeout", "QuoteService", function ($timeout, QuoteService) {
    return {
      restrict: 'A',
      require: '^stkStockTable',
      scope: {
        stock: '=',
        isLast: '='
      },
      link: function ($scope, $element, $attrs, stockTableCtrl) {
        // Create tooltip for stock-row
        $element.tooltip({
          placement: 'left',
          title: $scope.stock.company.name
        });

        // Add this row to the TableCtrl
        stockTableCtrl.addRow($scope);

        // Register this stock with the QuoteService
        QuoteService.register($scope.stock);

        // Deregister company with the QuoteService on $destroy
        $scope.$on('$destroy', function () {
          stockTableCtrl.removeRow($scope);
          QuoteService.deregister($scope.stock);
        });

        // If this is the last `stock-row`, fetch quotes immediately
        if ($scope.isLast) {
          $timeout(QuoteService.fetch);
        }

        // Watch for changes in shares and recalculate fields
        $scope.$watch('stock.shares', function () {
          $scope.stock.marketValue = $scope.stock.shares *
            $scope.stock.lastPrice;
          $scope.stock.dayChange = $scope.stock.shares *
            parseFloat($scope.stock.change);
          $scope.stock.save();
        });
      }
    };
  }]);
'use strict';

var NUMBER_REGEXP = /^\s*(\-|\+)?(\d+|(\d*(\.\d*)))\s*$/;

angular.module('stockDogApp')
  .directive('contenteditable', ["$sce", function ($sce) {
    return {
      restrict: 'A',
      require: 'ngModel', // get a hold of NgModelController
      link: function($scope, $element, $attrs, ngModelCtrl) {
        if(!ngModelCtrl) { return; } // do nothing if no ng-model

        // Specify how UI should be updated
        ngModelCtrl.$render = function() {
          $element.html($sce.getTrustedHtml(ngModelCtrl.$viewValue || ''));
        };

        // Read HTML value, then write data to the model or reset the view
        var read = function () {
          var value = $element.html();
          if ($attrs.type === 'number' && !NUMBER_REGEXP.test(value)) {
            ngModelCtrl.$render();
          } else {
            ngModelCtrl.$setViewValue(value);
          }
        };

        // Add custom parser based input type (only `number` supported)
        // This will be applied to the $modelValue
        if ($attrs.type === 'number') {
          ngModelCtrl.$parsers.push(function (value) {
            return parseFloat(value);
          });
        }

        // Listen for change events to enable binding
        $element.on('blur keyup change', function() {
          $scope.$apply(read);
        });
      }
    };
  }]);
'use strict';

angular.module('stockDogApp')
  .directive('stkSignColor', function () {
    return {
      restrict: 'A',
      link: function ($scope, $element, $attrs) {
        $attrs.$observe('stkSignColor', function (newVal) {
          var newSign = parseFloat(newVal);
          if (newSign > 0) {
            $element[0].style.color = 'Green';
          } else {
            $element[0].style.color = 'Red';
          }
        });
      }
    };
  });
'use strict';

angular.module('stockDogApp')
  .directive('stkSignFade', ["$animate", function ($animate) {
    return {
      restrict: 'A',
      link: function ($scope, $element, $attrs) {
        var oldVal = null;
        $attrs.$observe('stkSignFade', function (newVal) {
          if (oldVal && oldVal == newVal) { return; }

          oldVal = newVal;
          var oldPrice = parseFloat(oldVal);
          var newPrice = parseFloat(newVal);

          if (oldPrice && newPrice) {
            var direction = newPrice - oldPrice >= 0 ? 'up' : 'down';
            $animate.addClass($element, 'change-' + direction, function() {
              $animate.removeClass($element, 'change-' + direction);
            });
          }
        });
      }
    };
  }]);
angular.module('stockDogApp').run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('views/dashboard.html',
    "<div class=\"row\"> <!-- Left Column --> <div class=\"col-md-3\"> <stk-watchlist-panel></stk-watchlist-panel> </div> <!-- Right Column --> <div class=\"col-md-9\"> <div class=\"panel panel-info\"> <div class=\"panel-heading\"> <span class=\"glyphicon glyphicon-globe\"></span> Portfolio Overview </div> <div class=\"panel-body\"> <div ng-hide=\"watchlists.length && watchlists[0].stocks.length\" class=\"jumbotron\"> <h1>Unleash the hounds!</h1> <p> StockDog, your personal investment watchdog, is ready to be set loose on the financial markets! </p> <p>Create a watchlist and add some stocks to begin monitoring.</p> </div> <div ng-show=\"watchlists.length && watchlists[0].stocks.length\"> <!-- Top Row --> <div class=\"row\"> <!-- Left Column --> <div class=\"col-md-6\"> <div stk-sign-fade=\"{{marketValue}}\" class=\"well\"> <h2>{{marketValue | currency}}</h2> <h5>Total Market Value</h5> </div> </div> <!-- Right Column --> <div class=\"col-md-6\"> <div class=\"well\" stk-sign-color=\"{{dayChange}}\"> <h2>{{dayChange | currency}}</h2> <h5>Total Day Change</h5> </div> </div> </div> <!-- Bottom Row --> <div class=\"row\"> <!-- Left Column --> <div class=\"col-md-6\"> <div google-chart chart=\"donutChart\" style=\"{{cssStyle}}\"></div> </div> <!-- Right Column --> <div class=\"col-md-6\"> <div google-chart chart=\"columnChart\" style=\"{{cssStyle}}\"></div> </div> </div> </div> </div> </div> </div> </div>"
  );


  $templateCache.put('views/templates/addlist-modal.html',
    "<div class=\"modal\" tabindex=\"-1\" role=\"dialog\"> <div class=\"modal-dialog\"> <div class=\"modal-content\"> <div class=\"modal-header\"> <!-- [1] Invoke $modal.$hide() on click --> <button type=\"button\" class=\"close\" ng-click=\"$hide()\">&times; </button> <h4 class=\"modal-title\">Create New Watchlist</h4> </div> <!-- [2] Name this form for validation purposes --> <form role=\"form\" id=\"add-list\" name=\"listForm\"> <div class=\"modal-body\"> <div class=\"form-group\"> <label for=\"list-name\">Name</label> <!-- [3] Bind input to watchlist.name --> <input type=\"text\" class=\"form-control\" id=\"list-name\" placeholder=\"Name this watchlist\" ng-model=\"watchlist.name\" required> </div> <div class=\"form-group\"> <label for=\"list-description\">Brief Description</label> <!-- [4] Bind input to watchlist.description --> <input type=\"text\" class=\"form-control\" id=\"list-description\" maxlength=\"40\" placeholder=\"Describe this watchlist\" ng-model=\"watchlist.description\" required> </div> </div> <div class=\"modal-footer\"> <!-- [5] Create list on click, but disable if form is invalid --> <button type=\"submit\" class=\"btn btn-success\" ng-click=\"createList()\" ng-disabled=\"!listForm.$valid\">Create</button> <button type=\"button\" class=\"btn btn-danger\" ng-click=\"$hide()\">Cancel</button> </div> </form> </div> </div> </div>"
  );


  $templateCache.put('views/templates/addstock-modal.html',
    "<div class=\"modal\" tabindex=\"-1\" role=\"dialog\"> <div class=\"modal-dialog\"> <div class=\"modal-content\"> <div class=\"modal-header\"> <button type=\"button\" class=\"close\" ng-click=\"$hide()\">&times;</button> <h4 class=\"modal-title\">Add New Stock</h4> </div> <form role=\"form\" id=\"add-stock\" name=\"stockForm\"> <div class=\"modal-body\"> <div class=\"form-group\"> <label for=\"stock-symbol\">Symbol</label> <input type=\"text\" class=\"form-control\" id=\"stock-symbol\" placeholder=\"Stock Symbol\" ng-model=\"newStock.company\" bs-options=\"company as company.label for company in companies\" bs-typeahead required> </div> <div class=\"form-group\"> <label for=\"stock-shares\">Shares Owned</label> <input type=\"number\" class=\"form-control\" id=\"stock-shares\" placeholder=\"# Shares Owned\" ng-model=\"newStock.shares\" required> </div> </div> <div class=\"modal-footer\"> <button type=\"submit\" class=\"btn btn-success\" ng-click=\"addStock()\" ng-disabled=\"!stockForm.$valid\">Add</button> <button type=\"button\" class=\"btn btn-danger\" ng-click=\"$hide()\">Cancel</button> </div> </form> </div> </div> </div>"
  );


  $templateCache.put('views/templates/stock-table.html',
    "<table class=\"table\"> <thead> <tr> <td>Symbol</td> <td>Shares Owned</td> <td>Last Price</td> <td>Price Change <span> ( <span ng-disabled=\"showPercent === false\"> <a ng-click=\"showPercent = !showPercent\">$</a> </span>| <span ng-disabled=\"showPercent === true\"> <a ng-click=\"showPercent = !showPercent\">%</a> </span>) </span> </td> <td>Market Value</td> <td>Day Change</td> </tr> </thead> <tfoot ng-show=\"watchlist.stocks.length > 1\"> <tr> <td>Totals</td> <td>{{watchlist.shares}}</td> <td></td> <td></td> <td stk-sign-fade=\"{{watchlist.marketValue}}\">{{watchlist.marketValue | currency}}</td> <td stk-sign-color=\"{{watchlist.dayChange}}\">{{watchlist.dayChange | currency}}</td> </tr> </tfoot> <tbody> <tr stk-stock-row ng-repeat=\"stock in watchlist.stocks track by $index\" stock=\"stock\" is-last=\"$last\"> <td>{{stock.company.symbol}}</td> <td contenteditable type=\"number\" ng-model=\"stock.shares\"></td> <td stk-sign-fade=\"{{stock.lastPrice}}\">{{stock.lastPrice | currency}}</td> <td stk-sign-color=\"{{stock.change}}\"> <span ng-hide=\"showPercent\">{{stock.change}}</span> <span ng-show=\"showPercent\">{{stock.percentChange}}</span> </td> <td>{{stock.marketValue | currency}}</td> <td stk-sign-color=\"{{stock.dayChange}}\">{{stock.dayChange | currency}} <button type=\"button\" class=\"close\" ng-click=\"removeStock(stock)\">&times;</button> </td> </tr> </tbody> </table> <div class=\"small text-center\">Click on Shares Owned cell to edit.</div>"
  );


  $templateCache.put('views/templates/watchlist-panel.html',
    "<div class=\"panel panel-info\"> <div class=\"panel-heading\"> <span class=\"glyphicon glyphicon-eye-open\"></span> Watchlists <!-- Invoke showModal() handler on click --> <button type=\"button\" class=\"btn btn-success btn-xs pull-right\" ng-click=\"showModal()\"> <span class=\"glyphicon glyphicon-plus\"></span> </button> </div> <div class=\"panel-body\"> <!-- Show help text if no watchlists exist --> <div ng-if=\"!watchlists.length\" class=\"text-center\"> Use <span class=\"glyphicon glyphicon-plus\"></span> to create a list </div> <div class=\"list-group\"> <!-- Repeat over each list in watchlists and create link --> <a class=\"list-group-item\" ng-class=\"{ active: currentList == list.id }\" ng-repeat=\"list in watchlists track by $index\" ng-click=\"gotoList(list.id)\"> {{list.name}} <!-- Delete this list by invoking deleteList() handler --> <button type=\"button\" class=\"close\" ng-click=\"deleteList(list)\">&times; </button> </a> </div> </div> </div>"
  );


  $templateCache.put('views/watchlist.html',
    "<div class=\"row\"> <!-- Left Column --> <div class=\"col-md-3\"> <stk-watchlist-panel></stk-watchlist-panel> </div> <!-- Right Column --> <div class=\"col-md-9\"> <div class=\"panel panel-info\"> <div class=\"panel-heading\"> <span class=\"glyphicon glyphicon-list\"></span> {{watchlist.description}} <button type=\"button\" class=\"btn btn-success btn-xs pull-right\" ng-click=\"showStockModal()\"> <span class=\"glyphicon glyphicon-plus\"></span> </button> </div> <div class=\"panel-body table-responsive\"> <div ng-hide=\"stocks.length\" class=\"jumbotron\"> <h1>Woof.</h1> <p>Looks like you haven't added any stocks to this watchlist yet!</p> <p>Do so now by clicking the <span class=\"glyphicon glyphicon-plus\"></span> located above.</p> </div> <!-- loop over all stocks and display company symbols --> <stk-stock-table ng-show=\"stocks.length\" watchlist=\"watchlist\"> </stk-stock-table></div> </div> </div> </div>"
  );

}]);
