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

function CheckoutShippingController($exceptionHandler, $rootScope, toastr, OrderCloud, MyAddressesModal, AddressSelectModal, CurrentOrder) {
    var vm = this;
    vm.createAddress = createAddresss;
    vm.changeShippingAddress = changeShippingAddress;

    function createAddresss() {
        return MyAddressesModal.Create()
            .then(function(address) {
                toastr.success('Address Created', 'Success');
                CurrentOrder.ShippingAddressID = address.ID;
                saveShipAddress(CurrentOrder);
            });
    }

    function changeShippingAddress(addresses) {
        AddressSelectModal.Open(addresses)
            .then(function(address) {
                CurrentOrder.ShippingAddressID = address.ID;
                saveShipAddress(CurrentOrder);
            });
    }

    function saveShipAddress() {
        if (CurrentOrder && CurrentOrder.ShippingAddressID) {
            OrderCloud.Orders.Patch(CurrentOrder.ID, {ShippingAddressID: CurrentOrder.ShippingAddressID})
                .then(function(updatedOrder) {
                    $rootScope.$broadcast('OrderShippingAddressChanged', updatedOrder);
                })
                .catch(function(ex){
                    $exceptionHandler(ex);
                });
        }
    }
}