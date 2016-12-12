angular.module('orderCloud')
    .config(ProductBrowseConfig)
    .controller('ProductBrowseCtrl', ProductBrowseController)
    .controller('ProductViewCtrl', ProductViewController)
    .directive('preventClick', PreventClick);

function ProductBrowseConfig($urlRouterProvider, $stateProvider) {
    $urlRouterProvider.when('/browse', '/browse/products');
    $stateProvider
        .state('productBrowse', {
            abstract: true,
            parent: 'base',
            url: '/browse',
            templateUrl: 'productBrowse/templates/productBrowse.tpl.html',
            controller: 'ProductBrowseCtrl',
            controllerAs: 'productBrowse',
            resolve: {
                Parameters: function ($stateParams, OrderCloudParameters) {
                    return OrderCloudParameters.Get($stateParams);
                },
                CategoryList: function(OrderCloud) {
                    return OrderCloud.Me.ListCategories(null, 1, 100, null, null, null, 'all');
                },
                CategoryTree: function(CategoryList, Underscore) {
                    var result = [];
                    angular.forEach(Underscore.where(CategoryList.Items, {ParentID: null}), function(node) {
                        result.push(getnode(node));
                    });
                    function getnode(node) {
                        var children = Underscore.where(CategoryList.Items, {ParentID: node.ID});
                        if (children.length > 0) {
                            node.children = children;
                            angular.forEach(children, function(child) {
                                return getnode(child);
                            });
                        } else {
                            node.children = [];
                        }
                        return node;
                    }
                    return result;
                }
            }
        })
        .state('productBrowse.products', {
            url: '/products?categoryid?favorites?search?page?pageSize?searchOn?sortBy?filters?depth?suppliers',
            templateUrl: 'productBrowse/templates/productView.tpl.html',
            controller: 'ProductViewCtrl',
            controllerAs: 'productView',
            resolve: {
                Parameters: function ($stateParams, OrderCloudParameters) {
                    return OrderCloudParameters.Get($stateParams);
                },
                ProductList: function(OrderCloud, CurrentUser, Parameters) {
                    if (Parameters.favorites && CurrentUser.xp.FavoriteProducts) {
                        Parameters.filters ? angular.extend(Parameters.filters, Parameters.filters, {ID:CurrentUser.xp.FavoriteProducts.join('|')}) : Parameters.filters = {ID:CurrentUser.xp.FavoriteProducts.join('|')};
                    } else if (Parameters.filters) {
                        delete Parameters.filters.ID;
                    }

                    //Filter By ShipFromAddressID for Cups (mocked suppliers)
                    if (Parameters.suppliers) {
                        Parameters.filters ? angular.extend(Parameters.filters, Parameters.filters, {ShipFromAddressID:Parameters.suppliers}) : Parameters.filters = {ShipFromAddressID:Parameters.suppliers};
                    } else if (Parameters.filters) {
                        delete Parameters.filters.ShipFromAddressID;
                    }

                    return OrderCloud.Me.ListProducts(Parameters.search, Parameters.page, Parameters.pageSize, Parameters.searchOn, Parameters.sortBy, Parameters.filters, Parameters.categoryid);
                }
            }
        });
}

function ProductBrowseController($state, Underscore, CategoryList, CategoryTree, SuppliersList, OrderCloudParameters, Parameters) {
    var vm = this;
    vm.parameters = Parameters;
    vm.categoryList = CategoryList;

    //Category Tree Setup
    vm.treeData = CategoryTree;
    vm.treeOptions = {
        equality: function(node1, node2) {
            if (node2 && node1) {
                return node1.ID === node2.ID;
            } else {
                return node1 === node2;
            }
        }
    };

    vm.selectNode = function(node) {
        $state.go('productBrowse.products', {categoryid:node.ID, page:''});
    };

    //Initiate breadcrumbs is triggered by product list view (child state "productBrowse.products")
    vm.initBreadcrumbs = function(activeCategoryID, ignoreSetNode) {
        if (!ignoreSetNode) { //first iteration of initBreadcrumbs(), initiate breadcrumb array, set selected node for tree
            vm.selectedNode = {ID:activeCategoryID};
            vm.breadcrumb = [];
        }
        if (!activeCategoryID) { //at the catalog root, no expanded nodes
            vm.expandedNodes = angular.copy(vm.breadcrumb);
        } else {
            var activeCategory = Underscore.findWhere(vm.categoryList.Items, {ID: activeCategoryID});
            if (activeCategory) {
                vm.breadcrumb.unshift(activeCategory);
                if (activeCategory.ParentID) {
                    vm.initBreadcrumbs(activeCategory.ParentID, true);
                } else { //last iteration, set tree expanded nodes to the breadcrumb
                    vm.expandedNodes = angular.copy(vm.breadcrumb);
                }
            }
        }

    };

    vm.toggleFavorites = function() {
        if (vm.parameters.filters && vm.parameters.filters.ID) delete vm.parameters.filters.ID;
        if (vm.parameters.favorites) {
            vm.parameters.favorites = '';
        } else {
            vm.parameters.favorites = true;
            vm.parameters.page = '';
        }
        $state.go('productBrowse.products', vm.parameters);
    };

    //Cups Specific
    vm.suppliers = SuppliersList;
    //Filter current product list by supplier
    vm.toggleSupplier = function(supplier) {
        if (vm.parameters.filters && vm.parameters.filters.ShipFromAddressID) delete vm.parameters.ShipFromAddressID;
        var suppliers = vm.parameters.suppliers ? vm.parameters.suppliers.split('|') : [];
        var existingIndex = suppliers.indexOf(supplier.ID);
        if (existingIndex > -1) {
            suppliers.splice(existingIndex, 1);
        } else {
            suppliers.push(supplier.ID);
        }
        vm.parameters.suppliers = suppliers.join('|');
        $state.go('productBrowse.products', OrderCloudParameters.Create(vm.parameters));
    };
}

function ProductViewController($state, $ocMedia, ProductQuickView, OrderCloudParameters, OrderCloud, CurrentOrder, ProductList, CategoryList, Parameters){
    var vm = this;
    vm.parameters = Parameters;
    vm.categories = CategoryList;
    vm.list = ProductList;

    vm.sortSelection = Parameters.sortBy ? (Parameters.sortBy.indexOf('!') == 0 ? Parameters.sortBy.split('!')[1] : Parameters.sortBy) : null;

    //Filtering and Search Functionality
    //check if filters are applied
    vm.filtersApplied = vm.parameters.filters || ($ocMedia('max-width: 767px') && vm.sortSelection);
    vm.showFilters = vm.filtersApplied;


    //reload the state with new filters
    vm.filter = function(resetPage) {
        $state.go('.', OrderCloudParameters.Create(vm.parameters, resetPage));
    };

    //clear the relevant filters, reload the state & reset the page
    vm.clearFilters = function() {
        vm.parameters.filters = null;
        $ocMedia('max-width: 767px') ? vm.parameters.sortBy = null : angular.noop();
        vm.filter(true);
    };

    vm.updateSort = function(value) {
        value ? angular.noop() : value = vm.sortSelection;
        switch (vm.parameters.sortBy) {
            case value:
                vm.parameters.sortBy = '!' + value;
                break;
            case '!' + value:
                vm.parameters.sortBy = null;
                break;
            default:
                vm.parameters.sortBy = value;
        }
        vm.filter(false);
    };

    vm.reverseSort = function() {
        Parameters.sortBy.indexOf('!') == 0 ? vm.parameters.sortBy = Parameters.sortBy.split('!')[1] : vm.parameters.sortBy = '!' + Parameters.sortBy;
        vm.filter(false);
    };

    //reload the state with the incremented page parameter
    vm.pageChanged = function() {
        $state.go('.', {
            page: vm.list.Meta.Page
        });
    };

    //load the next page of results with all the same parameters
    vm.loadMore = function() {
        return OrderCloud.Me.ListProducts(Parameters.search, vm.list.Meta.Page + 1, Parameters.pageSize || vm.list.Meta.PageSize, Parameters.searchOn, Parameters.sortBy, Parameters.filters)
            .then(function(data) {
                vm.list.Items = vm.list.Items.concat(data.Items);
                vm.list.Meta = data.Meta;
            });
    };

    vm.quickView = function(product) {
        ProductQuickView.Open(CurrentOrder, product)
            .then(function(data) {

            })
    }
}

function PreventClick(){
    return {
        link: function($scope, element) {
            element.on("click", function(e){
                e.stopPropagation();
            });
        }
    };
}