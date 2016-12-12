angular.module('orderCloud')
    .factory('AddressSelectModal', AddressSelectModalService)
    .controller('AddressSelectCtrl', AddressSelectController)
;

function AddressSelectModalService($uibModal) {
    var service = {
        Open: _open
    };

    function _open(type) {
        return $uibModal.open({
            templateUrl: 'checkout/common/addressSelect/templates/addressSelect.modal.tpl.html',
            controller: 'AddressSelectCtrl',
            controllerAs: 'addressSelect',
            backdrop: 'static',
            size: 'md',
            resolve: {
                Addresses: function(OrderCloud) {
                    if (type == 'shipping') {
                        return OrderCloud.Me.ListAddresses(null, 1, 100, null, null, {Shipping: true});
                    } else if (type == 'billing') {
                        return OrderCloud.Me.ListAddresses(null, 1, 100, null, null, {Billing: true});
                    } else {
                        return OrderCloud.Me.ListAddresses(null, 1, 100);
                    }
                }
            }
        }).result;
    }

    return service;
}

function AddressSelectController($uibModalInstance, Addresses) {
    var vm = this;
    vm.addresses = Addresses;

    vm.select = function (address) {
        $uibModalInstance.close(address);
    };

    vm.createAddress = function() {
        $uibModalInstance.close('create');
    };

    vm.cancel = function () {
        $uibModalInstance.dismiss();
    };
}