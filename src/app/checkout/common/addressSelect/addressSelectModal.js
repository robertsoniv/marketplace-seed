angular.module('orderCloud')
    .factory('AddressSelectModal', AddressSelectModalService)
    .controller('AddressSelectCtrl', AddressSelectController)
;

function AddressSelectModalService($uibModal) {
    var service = {
        Open: _open
    };

    function _open(addresses) {
        return $uibModal.open({
            templateUrl: 'checkout/common/addressSelect/templates/addressSelect.modal.tpl.html',
            controller: 'AddressSelectCtrl',
            controllerAs: 'addressSelect',
            size: 'md',
            resolve: {
                Addresses: function() {
                    return addresses;
                }
            }
        }).result;
    }

    return service;
}

function AddressSelectController($uibModalInstance, Addresses) {
    var vm = this;
    vm.addresses = Addresses;
    vm.Select = select;

    function select(address) {
        $uibModalInstance.close(address);
    }
}