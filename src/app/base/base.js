angular.module('orderCloud')
    .config(BaseConfig)
    .controller('BaseCtrl', BaseController)
    .factory('NewOrder', NewOrderService)
    .filter('occomponents', occomponents)
;

function BaseConfig($stateProvider) {
    $stateProvider.state('base', {
        url: '',
        abstract: true,
        views: {
            '': {
                templateUrl: 'base/templates/base.tpl.html',
                controller: 'BaseCtrl',
                controllerAs: 'base'
            },
            'nav@base': {
                'templateUrl': 'base/templates/navigation.tpl.html'
            }
        },
        resolve: {
            CurrentUser: function($q, $state, OrderCloud, buyerid, anonymous) {
                var dfd = $q.defer();
                OrderCloud.Me.Get()
                    .then(function(data) {
                        dfd.resolve(data);
                    })
                    .catch(function(){
                        if (anonymous) {
                            if (!OrderCloud.Auth.ReadToken()) {
                                OrderCloud.Auth.GetToken('')
                                    .then(function(data) {
                                        OrderCloud.Auth.SetToken(data['access_token']);
                                    })
                                    .finally(function() {
                                        OrderCloud.BuyerID.Set(buyerid);
                                        dfd.resolve({});
                                    });
                            }
                        } else {
                            OrderCloud.Auth.RemoveToken();
                            OrderCloud.Auth.RemoveImpersonationToken();
                            OrderCloud.BuyerID.Set(null);
                            $state.go('login');
                            dfd.resolve();
                        }
                    });
                return dfd.promise;
            },
            CurrentOrder: function($q, OrderCloud, NewOrder) {
                var dfd = $q.defer();
                OrderCloud.Me.ListOutgoingOrders(null, 1, 1, null, "!DateCreated", {Status:"Unsubmitted"})
                    .then(function(data) {
                        if (data.Items.length) {
                            dfd.resolve(data.Items[0]);
                        } else {
                            NewOrder.Create({})
                                .then(function(data) {
                                    dfd.resolve(data);
                                })
                        }
                    });
                return dfd.promise;
            },
            AnonymousUser: function($q, OrderCloud, CurrentUser) {
                CurrentUser.Anonymous = angular.isDefined(JSON.parse(atob(OrderCloud.Auth.ReadToken().split('.')[1])).orderid);
            },
            SuppliersList: function(OrderCloud) {
                return OrderCloud.AdminAddresses.List();
            },
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
    });
}

function BaseController($rootScope, $state, Underscore, defaultErrorMessageResolver, ProductSearch, CurrentUser, CurrentOrder, SuppliersList, Parameters, CategoryList, CategoryTree, OrderCloudParameters, OrderCloud) {
    var vm = this;
    vm.currentUser = CurrentUser;
    vm.currentOrder = CurrentOrder;
    vm.registrationAvailable = Underscore.filter(vm.organizationItems, function(item) { return item.StateRef == 'registration' }).length;

    vm.mobileSearch = function() {
        ProductSearch.Open()
            .then(function(data) {
                if (data.productID) {
                    $state.go('productDetail', {productid: data.productID});
                } else {
                    $state.go('productSearchResults', {searchTerm: data.searchTerm});
                }
            });
    };

    defaultErrorMessageResolver.getErrorMessages().then(function (errorMessages) {
        errorMessages['customPassword'] = 'Password must be at least eight characters long and include at least one letter and one number';
        //regex for customPassword = ^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!$%@#£€*?&]{8,}$
        errorMessages['positiveInteger'] = 'Please enter a positive integer';
        //regex positiveInteger = ^[0-9]*[1-9][0-9]*$
        errorMessages['ID_Name'] = 'Only Alphanumeric characters, hyphens and underscores are allowed';
        //regex ID_Name = ([A-Za-z0-9\-\_]+)
        errorMessages['confirmpassword'] = 'Your passwords do not match';
        errorMessages['noSpecialChars'] = 'Only Alphanumeric characters are allowed';
    });

    $rootScope.$on('LineItemAddedToCart', function() {
        OrderCloud.Me.ListOutgoingOrders(null, 1, 1, null, "!DateCreated", {Status:"Unsubmitted"})
            .then(function(data) {
                vm.currentOrder = data.Items[0];
            })
    })

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
        $state.go('productBrowse', {categoryid:node.ID, page:''});
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
        $state.go('productBrowse', vm.parameters);
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
        $state.go('productBrowse', OrderCloudParameters.Create(vm.parameters));
    };
}

function NewOrderService($q, OrderCloud) {
    var service = {
        Create: _create
    };

    function _create() {
        var deferred = $q.defer();
        var order = {};

        //ShippingAddressID
        OrderCloud.Me.ListAddresses(null, 1, 100, null, null, {Shipping: true})
            .then(function(shippingAddresses) {
                if (shippingAddresses.Items.length) order.ShippingAddressID = shippingAddresses.Items[0].ID;
                setBillingAddress();
            });

        //BillingAddressID
        function setBillingAddress() {
            OrderCloud.Me.ListAddresses(null, 1, 100, null, null, {Billing: true})
                .then(function(billingAddresses) {
                    if (billingAddresses.Items.length) order.BillingAddressID = billingAddresses.Items[0].ID;
                    createOrder();
                });
        }

        function createOrder() {
            OrderCloud.Orders.Create(order)
                .then(function(order) {
                    deferred.resolve(order);
                });
        }

        return deferred.promise;
    }

    return service;
}

function occomponents() {
    return function(components) {
        var filtered = ['registration'];
        var result = [];

        angular.forEach(components, function(component) {
            if (filtered.indexOf(component.StateRef) == -1) result.push(component);
        });

        return result;
    }
}
