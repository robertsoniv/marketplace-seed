angular.module('orderCloud')
	.config(checkoutBillingConfig)
	.controller('CheckoutBillingCtrl', CheckoutBillingController)
    .factory('creditCardExpirationDate', creditCardExpirationDate)
;

function checkoutBillingConfig($stateProvider) {
	$stateProvider
		.state('checkout.billing', {
			url: '/billing',
			templateUrl: 'checkout/billing/templates/checkout.billing.tpl.html',
			controller: 'CheckoutBillingCtrl',
			controllerAs: 'checkoutBilling',
			resolve: {
				BillingAddresses: function(OrderCloud) {
                    return OrderCloud.Me.ListAddresses(null, 1, 100, null, null, {Billing: true});
				}
			}
		});
}

function CheckoutBillingController($state, $rootScope, $exceptionHandler, OrderCloud, MyAddressesModal,  BillingAddresses) {
	var vm = this;
	vm.billingAddresses = BillingAddresses;
    vm.SaveBillingAddress = SaveBillingAddress;
    vm.createAddress = createAddress;

    function SaveBillingAddress(order) {
        if (order && order.BillingAddressID) {
            OrderCloud.Orders.Patch(order.ID, {BillingAddressID: order.BillingAddressID})
                .then(function(updatedOrder) {
                    $rootScope.$broadcast('OrderBillingAddressUpdated', updatedOrder);
                })
                .catch(function(ex) {
                    $exceptionHandler(ex);
                });
        }
    }
    function createAddress(){
        return MyAddressesModal.Create();
    }
}

function creditCardExpirationDate() {
    //return the expirationMonth array and its function
    var expirationDate = {
        expirationMonth: [{
            number: 1,
            string: '01'
        }, {
            number: 2,
            string: '02'
        }, {
            number: 3,
            string: '03'
        }, {
            number: 4,
            string: '04'
        }, {
            number: 5,
            string: '05'
        }, {
            number: 6,
            string: '06'
        }, {
            number: 7,
            string: '07'
        }, {
            number: 8,
            string: '08'
        }, {
            number: 9,
            string: '09'
        }, {
            number: 10,
            string: '10'
        }, {
            number: 11,
            string: '11'
        }, {
            number: 12,
            string: '12'
        }],
        expirationYear: [],
        isLeapYear: function leapYear(year) {
            return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
        }
    };

    function _ccExpireYears() {
        var today = new Date();
        today = today.getFullYear();

        for (var x = today; x < today + 21; x++) {
            expirationDate.expirationYear.push(x);
        }
        return expirationDate.expirationYear;
    }
    _ccExpireYears();
    return expirationDate;
}