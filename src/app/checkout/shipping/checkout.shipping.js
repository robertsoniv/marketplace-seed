angular.module('orderCloud')
    .config(checkoutShippingConfig)
    .controller('CheckoutShippingCtrl', CheckoutShippingController);

function checkoutShippingConfig($stateProvider) {
    $stateProvider
        .state('checkout.shipping', {
            url: '/shipping',
            templateUrl: 'checkout/shipping/templates/checkout.shipping.tpl.html',
            controller: 'CheckoutShippingCtrl',
            controllerAs: 'checkoutShipping'
        });
}

function CheckoutShippingController($exceptionHandler, $rootScope, toastr, OrderCloud, MyAddressesModal, AddressSelectModal, ShippingRates, CurrentOrder, CheckoutConfig) {
    var vm = this;
    vm.createAddress = createAddress;
    vm.changeShippingAddress = changeShippingAddress;
    vm.shipperSelected = shipperSelected;

    function createAddress() {
        MyAddressesModal.Create()
            .then(function(address) {
                toastr.success('Address Created', 'Success');
                CurrentOrder.ShippingAddressID = address.ID;
                saveShipAddress(CurrentOrder);
            });
    }

    function changeShippingAddress() {
        AddressSelectModal.Open('shipping')
            .then(function(address) {
                if (address == 'create') {
                    createAddress();
                } else {
                    CurrentOrder.ShippingAddressID = address.ID;
                    saveShipAddress(CurrentOrder);
                }
            })
    }

    function saveShipAddress() {
        if (CurrentOrder && CurrentOrder.ShippingAddressID) {
            OrderCloud.Orders.Patch(CurrentOrder.ID, {ShippingAddressID: CurrentOrder.ShippingAddressID})
                .then(function(updatedOrder) {
                    $rootScope.$broadcast('OrderShippingAddressChanged', updatedOrder);
                    getShippingRates();
                })
                .catch(function(ex){
                    $exceptionHandler(ex);
                });
        }
    }

    if (CheckoutConfig.ShippingRates && CurrentOrder.ShippingAddressID) getShippingRates();

    function getShippingRates() {
        ShippingRates.GetRates(CurrentOrder)
            .then(function(shipments) {
                vm.shippingRates = shipments;
                analyzeShipments();
            });
    }

    function analyzeShipments() {
        vm.shippingRates = ShippingRates.AnalyzeShipments(CurrentOrder, vm.shippingRates);
    }

    function shipperSelected() {
        ShippingRates.ManageShipments(CurrentOrder, vm.shippingRates)
            .then(function() {
                $rootScope.$broadcast('OC:UpdateOrder', CurrentOrder.ID);
            });
    }
}