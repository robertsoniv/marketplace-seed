angular.module('orderCloud')
	.config(checkoutConfig)
	.controller('CheckoutCtrl', CheckoutController)
	.factory('CheckoutService', CheckoutService)
	.controller('OrderReviewCtrl', OrderReviewController)
	.controller('OrderConfirmationCtrl', OrderConfirmationController)
    .directive('ordercloudConfirmationLineitems', ConfirmationLineItemsListDirective)
    .controller('ConfirmationLineItemsCtrl', ConfirmationLineItemsController)
    .constant('isMultipleAddressShipping', false)
;

function checkoutConfig($stateProvider) {
	$stateProvider
		.state('checkout', {
			parent: 'base',
			url: '/checkout',
			templateUrl: 'checkout/templates/checkout.tpl.html',
			controller: 'CheckoutCtrl',
			controllerAs: 'checkout',
			resolve: {
                ShippingAddresses: function(OrderCloud) {
                    return OrderCloud.Me.ListAddresses(null, 1, 100, null, null, {Shipping: true});
                },
                OrderShipAddress: function($q, OrderCloud, CurrentOrder){
                    var deferred = $q.defer();

                    if (CurrentOrder.ShippingAddressID) {
                        OrderCloud.Me.GetAddress(CurrentOrder.ShippingAddressID)
                            .then(function(address) {
                                deferred.resolve(address);
                            })
                            .catch(function(ex) {
                                deferred.resolve(null);
                            });
                    }
                    else {
                        deferred.resolve(null);
                    }

                    return deferred.promise;
                },
                BillingAddresses: function(OrderCloud) {
                    return OrderCloud.Me.ListAddresses(null, 1, 100, null, null, {Billing: true});
                },
                OrderBillingAddress: function($q, OrderCloud, CurrentOrder){
                    var deferred = $q.defer();

                    if (CurrentOrder.BillingAddressID) {
                        OrderCloud.Me.GetAddress(CurrentOrder.BillingAddressID)
                            .then(function(address) {
                                deferred.resolve(address);
                            })
                            .catch(function(ex) {
                                deferred.resolve(null);
                            });
                    }
                    else {
                        deferred.resolve(null);
                    }

                    return deferred.promise;
                },
                OrderPayments: function($q, OrderCloud, CurrentOrder) {
                    var deferred = $q.defer();
                    OrderCloud.Payments.List(CurrentOrder.ID)
                        .then(function(data) {
                            if (!data.Items.length) {
                                OrderCloud.Payments.Create(CurrentOrder.ID, {})
                                    .then(function(p) {
                                        deferred.resolve({Items: [p]});
                                    });
                            }
                            else {
                                deferred.resolve(data);
                            }
                        });

                    return deferred.promise;
                }
			}
		})
        .state('checkout.confirmation', {
            url: '/confirmation',
            views: {
                '@base': {
                    templateUrl: 'checkout/templates/confirmation.tpl.html',
                    controller: 'OrderConfirmationCtrl',
                    controllerAs: 'orderConfirmation'
                }
            }
        })
		.state('orderReview', {
            parent: 'base',
			url: '/order/:orderid/review',
            templateUrl: 'checkout/templates/review.tpl.html',
            controller: 'OrderReviewCtrl',
            controllerAs: 'orderReview',
            resolve: {
                SubmittedOrder: function($q, $stateParams, $state, toastr, OrderCloud) {
                    var dfd = $q.defer();
                    OrderCloud.Me.GetOrder($stateParams.orderid)
                        .then(function(order) {
                            if (order.Status === 'Unsubmitted') {
                                $state.go('checkout.shipping')
                                    .then(function() {
                                        toastr.error('You cannot review an Unsubmitted Order', 'Error');
                                        dfd.reject();
                                    });
                            }
                            else dfd.resolve(order);
                        });
                    return dfd.promise;
                }
			}
		})
    ;
}

function CheckoutService() {
    var lineItems = [];
    return {
        StoreLineItems: _storeLineItems,
        GetLineItems: _getLineItems
    };

    function _storeLineItems(items) {
        lineItems = items;
    }

    function _getLineItems() {
        return lineItems;
    }
}

function CheckoutController($state, $rootScope, toastr, OrderCloud, CheckoutService, CurrentOrder, ShippingAddresses, OrderShipAddress, BillingAddresses, OrderBillingAddress, OrderPayments) {
    var vm = this;
    vm.currentOrder = CurrentOrder;
    vm.currentOrder.ShippingAddress = OrderShipAddress;
    vm.currentOrder.BillingAddress = OrderBillingAddress;
    vm.shippingAddresses = ShippingAddresses.Items;
    vm.billingAddresses = BillingAddresses.Items;
    vm.isMultipleAddressShipping = true;
    vm.currentOrderPayments = OrderPayments.Items;

    vm.orderIsValid = function() {
        var orderPaymentsTotal = 0;
        var validPaymentMethods = false;
        angular.forEach(vm.currentOrderPayments, function(payment) {
            orderPaymentsTotal += payment.Amount;
            validPaymentMethods = !!((payment.Type == 'SpendingAccount' && payment.SpendingAccountID != null) || (payment.Type == 'CreditCard' && payment.CreditCardID != null) || payment.Type == 'PurchaseOrder');
        });
        return !!(orderPaymentsTotal === vm.currentOrder.Subtotal && validPaymentMethods && vm.currentOrder.BillingAddress && vm.currentOrder.BillingAddress.ID != null);
    };

    // default state (if someone navigates to checkout -> checkout.shipping)
    if ($state.current.name === 'checkout') {
        $state.transitionTo('checkout.shipping');
    }

    $rootScope.$on('OrderShippingAddressChanged', function(event, order) {
        vm.currentOrder = order;
        OrderCloud.Me.GetAddress(order.ShippingAddressID)
            .then(function(address){
                vm.currentOrder.ShippingAddress = address;
            });
    });
    $rootScope.$on('OrderBillingAddressUpdated', function(event, order){
        vm.currentOrder = order;
    });

    $rootScope.$on('OC:UpdateOrder', function(event, OrderID) {
        OrderCloud.Orders.Get(OrderID)
            .then(function(data) {
                vm.currentOrder.Subtotal = data.Subtotal;
            });
    });

    vm.checkShippingAddresses = function() {
        var lineItems = CheckoutService.GetLineItems();
        var orderValid = true;
        angular.forEach(lineItems, function(li) {
            var itemValid = false;
            if (li.ShippingAddressID) {
                itemValid = true;
            }
            else if (li.ShippingAddress && li.ShippingAddress.Street1) {
                itemValid = true;
            }
            if (!itemValid) orderValid = false;
        });
        if (orderValid) {
            $state.go('checkout.confirmation');
        }
        else {
            toastr.error('Please select a shipping address for all line items');
        }
    };
}

function OrderConfirmationController($rootScope, $state, toastr, OrderCloud, CurrentOrder, isMultipleAddressShipping, OrderPayments) {
    var vm = this;

    vm.currentOrder = CurrentOrder;
    vm.isMultipleAddressShipping = isMultipleAddressShipping;
    vm.orderPayments = OrderPayments.Items;

    angular.forEach(vm.orderPayments, function(payment, index) {
        if (payment.Type === 'CreditCard' && payment.CreditCardID) {
            OrderCloud.CreditCards.Get(payment.CreditCardID)
                .then(function(cc) {
                    vm.orderPayments[index].creditCardDetails = cc;
                })
                .catch(function(ex) {
                    toastr.error(ex, 'Error');
                });
        }
        if (payment.Type === 'SpendingAccount' && payment.SpendingAccountID) {
            OrderCloud.SpendingAccounts.Get(payment.SpendingAccountID)
                .then(function(sa) {
                    vm.orderPayments[index].spendingAccountDetails = sa;
                })
                .catch(function(ex) {
                    toastr.error(ex, 'Error');
                });
        }
    });

    vm.submitOrder = function() {
        OrderCloud.Orders.Submit(vm.currentOrder.ID)
            .then(function(order) {
                $state.go('orderReview', {orderid: order.ID});
                toastr.success('Your order has been submitted', 'Success');
                $rootScope.$broadcast('OC:RemoveOrder');
            })
            .catch(function(ex) {
                toastr.error('Your order did not submit successfully.', 'Error');
            });
    };
}

function OrderReviewController($q, toastr, OrderCloud, LineItemHelpers, SubmittedOrder, isMultipleAddressShipping) {
	var vm = this;
    vm.submittedOrder = SubmittedOrder;
    vm.isMultipleAddressShipping = isMultipleAddressShipping;

    OrderCloud.Payments.List(vm.submittedOrder.ID)
        .then(function(data) {
            vm.orderPayments = data.Items;
        })
        .then(function() {
            angular.forEach(vm.orderPayments, function(payment, index) {
                if (payment.Type === 'CreditCard' && payment.CreditCardID) {
                    OrderCloud.CreditCards.Get(payment.CreditCardID)
                        .then(function(cc) {
                            vm.orderPayments[index].creditCardDetails = cc;
                        })
                        .catch(function(ex) {
                            toastr.error(ex, 'Error');
                        })
                }
                if (payment.Type === 'SpendingAccount' && payment.SpendingAccountID) {
                    OrderCloud.SpendingAccounts.Get(payment.SpendingAccountID)
                        .then(function(sa) {
                            vm.orderPayments[index].spendingAccountDetails = sa;
                        })
                        .catch(function(ex) {
                            toastr.error(ex, 'Error');
                        })
                }
            });
        });

    var dfd = $q.defer();
    var queue = [];
    OrderCloud.LineItems.List(vm.submittedOrder.ID)
        .then(function(li) {
            vm.LineItems = li;
            if (li.Meta.TotalPages > li.Meta.Page) {
                var page = li.Meta.Page;
                while (page < li.Meta.TotalPages) {
                    page += 1;
                    queue.push(OrderCloud.LineItems.List(vm.submittedOrder.ID, page));
                }
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

    vm.print = function() {
        window.print();
    };
}

function ConfirmationLineItemsListDirective() {
    return {
        scope: {
            order: '='
        },
        templateUrl: 'checkout/templates/confirmation.lineitems.tpl.html',
        controller: 'ConfirmationLineItemsCtrl',
        controllerAs: 'confirmationLI'
    };
}

function ConfirmationLineItemsController($scope, $q, OrderCloud, LineItemHelpers, isMultipleAddressShipping) {
    var vm = this;
    vm.lineItems = {};
    vm.isMultipleAddressShipping = isMultipleAddressShipping;

    $scope.$watch(function() {
        return $scope.order.ID;
    }, function() {
        OrderCloud.LineItems.List($scope.order.ID)
            .then(function(data) {
                vm.lineItems = data;
                LineItemHelpers.GetProductInfo(vm.lineItems.Items);
            });
    });

    vm.pagingfunction = function() {
        if (vm.lineItems.Meta.Page < vm.lineItems.Meta.TotalPages) {
            var dfd = $q.defer();
            OrderCloud.LineItems.List($scope.order.ID, vm.lineItems.Meta.Page + 1, vm.lineItems.Meta.PageSize)
                .then(function(data) {
                    vm.lineItems.Meta = data.Meta;
                    vm.lineItems.Items = [].concat(vm.lineItems.Items, data.Items);
                    LineItemHelpers.GetProductInfo(vm.lineItems.Items);
                });
            return dfd.promise;
        }
        else return null;
    };
}
