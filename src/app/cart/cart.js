angular.module('orderCloud')
    .config(CartConfig)
    .controller('CartCtrl', CartController)
    .controller('MiniCartCtrl', MiniCartController)
    .directive('ordercloudMinicart', OrderCloudMiniCartDirective)
    .controller('MinicartModalController', MinicartModalController)
;

function CartConfig($stateProvider) {
    $stateProvider
        .state('cart', {
            parent: 'base',
            url: '/cart',
            templateUrl: 'cart/templates/cart.tpl.html',
            controller: 'CartCtrl',
            controllerAs: 'cart',
            resolve: {
                LineItemsList: function($q, $state, toastr, Underscore, OrderCloud, LineItemHelpers, CurrentOrder) {
                    var dfd = $q.defer();
                    OrderCloud.LineItems.List(CurrentOrder.ID)
                        .then(function(data) {
                            if (!data.Items.length) {
                                dfd.resolve(data);
                            }
                            else {
                                LineItemHelpers.GetProductInfo(data.Items)
                                    .then(function() {
                                        dfd.resolve(data);
                                    });
                            }
                        })
                        .catch(function() {
                            toastr.error('Your order does not contain any line items.', 'Error');
                            dfd.reject();
                        });
                    return dfd.promise;
                }
            }
        });
}

function CartController($rootScope, $state, OrderCloud, LineItemHelpers, CurrentOrder, LineItemsList, OrderCloudConfirm) {
    var vm = this;
    vm.order = CurrentOrder;
    vm.lineItems = LineItemsList;

    vm.updateQuantity = function(lineItem) {
        LineItemHelpers.UpdateQuantity(vm.order, lineItem);
    };

    vm.removeItem = function(lineItem) {
        LineItemHelpers.RemoveItem(vm.order, lineItem);
    };

    vm.cancelOrder = function(){
        OrderCloudConfirm.Confirm("Are you sure you want cancel this order?")
            .then(function() {
                OrderCloud.Orders.Delete(vm.order.ID)
                    .then(function(){
                        $state.go("home",{}, {reload:'base'})
                    })
            });

    };

    $rootScope.$on('OC:UpdateOrder', function(event, OrderID) {
        OrderCloud.Orders.Get(OrderID)
            .then(function(data) {
                vm.order = data;
            });
    });

    $rootScope.$on('OC:UpdateLineItem', function(event,Order) {
            OrderCloud.LineItems.List(Order.ID)
                .then(function(data) {
                    LineItemHelpers.GetProductInfo(data.Items)
                        .then(function() {
                            vm.lineItems = data;
                        });
                });
    });
}

function MiniCartController($q, $state, $rootScope,$uibModal, $ocMedia, OrderCloud, LineItemHelpers) {
    var vm = this;
    vm.LineItems = {};
    vm.Order = null;
    vm.showLineItems = false;
    vm.$ocMedia = $ocMedia;
    //TODO: remove current order
    //vm.getLI = function() {
    //    CurrentOrder.Get()
    //    .then(function(data) {
    //        vm.Order = data;
    //        if (data) vm.lineItemCall(data);
    //    });
    //};
    //
    //vm.getLI();

    vm.checkForExpress = function() {
        var expressCheckout = false;
        angular.forEach($state.get(), function(state) {
            if (state.url && state.url == '/expressCheckout') {
                expressCheckout = true;
                return expressCheckout;
            }
        });
        return expressCheckout;
    };

    vm.checkForCheckout = function() {
        var checkout = false;
        angular.forEach($state.get(), function(state) {
            if (state.url && state.url == '/checkout') {
                checkout = true;
                return checkout;
            }
        });
        return checkout;
    };

    vm.goToCart = function() {
        $state.go('cart', {}, {reload: true});
    };

    vm.lineItemCall = function /*getLineItems*/(order) {
        var dfd = $q.defer();
        var queue = [];
        OrderCloud.LineItems.List(order.ID)
            .then(function(li) {
                vm.LineItems = li;
                if (li.Meta.TotalPages > li.Meta.Page) {
                        queue.push(OrderCloud.LineItems.List(order.ID, null ,li.Meta.Page + 1));
                }
                $q.all(queue)
                    .then(function(results) {
                        angular.forEach(results, function(result) {
                            vm.LineItems.Items = [].concat(vm.LineItems.Items, result.Items);
                            vm.LineItems.Meta = result.Meta;
                        });
                        dfd.resolve(LineItemHelpers.GetProductInfo(vm.LineItems.Items.reverse()));
                    });
            });
        return dfd.promise;
    };
    //TODO: Remove current order
    //$rootScope.$on('LineItemAddedToCart', function() {
    //    CurrentOrder.Get()
    //        .then(function(order) {
    //            if (vm.$ocMedia('max-width:767px')) {
    //                vm.openModal(order);
    //            } else {
    //                vm.lineItemCall(order);
    //                vm.showLineItems = true;
    //            }
    //        });
    //});

    $rootScope.$on('OC:RemoveOrder', function() {//broadcast is in build > src > app > common > line items
        vm.Order = null;
        vm.LineItems = {};
    });

    vm.toggleDropdown = function($event) {
        // $event.preventDefault();
        // $event.stopPropagation();
        // $scope.status.isopen = !$scope.status.isopen;
        vm.showLineItems = true;
        if (vm.$ocMedia('max-width:767px')) {
            vm.goToCart();
        }
    };

    vm.openModal = function(order) {
        $uibModal.open({
            animation: true,
            size: 'lg',
            templateUrl: 'cart/templates/modalMinicart.tpl.html',
            controller: 'MinicartModalController',
            controllerAs: 'minicartModal',
            resolve: {
                LineItems: vm.lineItemCall(order)
            }
        });
    };
}

function OrderCloudMiniCartDirective() {
    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'cart/templates/minicart.tpl.html',
        controller: 'MiniCartCtrl',
        controllerAs: 'minicart'
    };
}

function MinicartModalController($state, $uibModalInstance, LineItems) {
    var vm = this;
    vm.lineItems = LineItems;
    vm.lineItemsLength = vm.lineItems.length;

    vm.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

    vm.goToCart = function() {
        $state.go('cart');
        $uibModalInstance.close();
    };

    vm.goToExpressCheckout = function() {
        $state.go('expressCheckout');
        $uibModalInstance.close();
    };

    vm.goToCheckout = function() {
        $state.go('checkout');
        $uibModalInstance.close();
    };
}

