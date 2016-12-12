describe('Component: Cart', function() {
    var scope,
        q,
        oc,
        currentOrder,
       lineItemHelpers,
        lineItemsList,
        fakeOrder,
        user
        ;
    beforeEach(module('orderCloud'));
    beforeEach(module('orderCloud.sdk'));
    beforeEach(module(function($provide) {
        $provide.value('CurrentOrder', {ID: "MockOrderID3456"})
    }));
    beforeEach(inject(function($rootScope, $q, OrderCloud, CurrentOrder, LineItemHelpers) {
        scope = $rootScope.$new();
        q = $q;
        oc = OrderCloud;
        currentOrder = CurrentOrder;
        lineItemHelpers = LineItemHelpers;
        fakeOrder = {
            ID: "TestOrder123456789",
            Type: "Standard",
            FromUserID: "TestUser123456789",
            BillingAddressID: "TestAddress123456789",
            ShippingAddressID: "TestAddress123456789",
            SpendingAccountID: null,
            Comments: null,
            PaymentMethod: null,
            CreditCardID: null,
            ShippingCost: null,
            TaxCost: null
        };
         lineItemsList = {
            "Items" : [{}, {}],
            "Meta" : {
                "Page": 1,
                "PageSize": 20,
                "TotalCount":29,
                "TotalPages": 3,
                "ItemRange" : [1,2]
             }
        };
        user = {
            ID: "TestUser132456789",
            xp: {
                defaultShippingAddressID: "TestAddress123456789",
                defaultBillingAddressID: "TestAddress123456789",
                defaultCreditCardID: "creditCard"
            }

        };
    }));

    describe('Configuration: CartConfig', function() {
        var state;
        beforeEach(inject(function($state) {
            state = $state.get('cart');
            var defer = q.defer();
            defer.resolve(lineItemsList);
            spyOn(oc.LineItems,'List').and.returnValue(defer.promise);
            spyOn(lineItemHelpers,'GetProductInfo').and.returnValue(defer.promise);

        }));
        it('should call LineItems.List',inject(function($injector){
            $injector.invoke(state.resolve.LineItemsList);
            expect(oc.LineItems.List).toHaveBeenCalledWith(currentOrder.ID);
        }));
        it('should call LineItemHelper', inject(function($injector){
            $injector.invoke(state.resolve.LineItemsList);
            scope.$digest();
            expect(lineItemHelpers.GetProductInfo).toHaveBeenCalled();
        }));
    });

    describe('Controller : CartController',function() {
        var cartController;
        beforeEach(inject(function($state, $controller) {
            cartController = $controller('CartCtrl', {
                $scope: scope,
                Order: fakeOrder,
                LineItemsList: lineItemsList,
                LineItemHelpers: lineItemHelpers,
                PromotionsList: []
            });
            var defer = q.defer();
            defer.resolve(lineItemsList);
            spyOn(lineItemHelpers,'UpdateQuantity').and.returnValue(defer.promise);
            spyOn(window,'confirm').and.returnValue(true);
            spyOn(oc.Orders, 'Delete').and.returnValue(defer.promise);
            spyOn(oc.Orders,'Get').and.returnValue(defer.promise);
            spyOn(oc.LineItems, 'List').and.returnValue(defer.promise);
            spyOn(lineItemHelpers,'GetProductInfo').and.returnValue(defer.promise);
        }));

       describe('updateQuantity',function(){
          it('should call LineItemHelpers UpdateQuantity Method', function(){
              cartController.updateQuantity(currentOrder,lineItemsList.Items[0]);
              expect(lineItemHelpers.UpdateQuantity).toHaveBeenCalledWith(currentOrder,lineItemsList.Items[0]);
          }) ;
       });
        describe('CancelOrder',function() {
         it('should call windows confirm prompt', function() {
             cartController.cancelOrder();
             expect(window.confirm).toHaveBeenCalled();
         });
         it('should call OC Orders Delete Method', function(){
             cartController.cancelOrder();
             expect(oc.Orders.Delete).toHaveBeenCalledWith(currentOrder.ID);
         });

        });
        describe('OC:UpdateOrder',function() {
            it('should call Orders Get Method', inject(function($rootScope) {
                $rootScope.$broadcast('OC:UpdateOrder' ,fakeOrder.ID);
                scope.$digest();
                expect(oc.Orders.Get).toHaveBeenCalledWith(fakeOrder.ID);
            }))
        });
        describe('OC:UpdateLineItem',function() {
            it('should call LineItems List Method', inject(function($rootScope) {
                $rootScope.$broadcast('OC:UpdateLineItem' ,fakeOrder);
                expect(oc.LineItems.List).toHaveBeenCalledWith(fakeOrder.ID);
            }));
            it('should call LineItemHelpers GetProductInfo Method', inject(function($rootScope) {
                $rootScope.$broadcast('OC:UpdateLineItem' ,fakeOrder);
                scope.$digest();
                expect(oc.LineItems.List).toHaveBeenCalledWith(fakeOrder.ID);
            }))
        });
    });

    describe('Controller: MiniCartController',function() {
        var miniCartController;
        beforeEach(inject(function($state, $controller) {
            miniCartController = $controller('MiniCartCtrl', {
                $scope: scope,
                CurrentOrder: currentOrder,
                LineItemHelpers: lineItemHelpers
            });
            var defer = q.defer();
            defer.resolve(lineItemsList);
            spyOn(oc.LineItems, 'List').and.returnValue(defer.promise);
            spyOn(lineItemHelpers, 'GetProductInfo').and.returnValue(defer.promise);

            var orderdfd = q.defer();
            orderdfd.resolve(fakeOrder);
            spyOn(currentOrder, 'Get').and.returnValue(orderdfd.promise);
        }));

        it('should call Get Method on Current Order and lineItemCall', function() {
            spyOn(miniCartController, 'lineItemCall').and.callThrough();
            miniCartController.getLI();
            expect(currentOrder.Get).toHaveBeenCalled();
            scope.$digest();
            expect(miniCartController.lineItemCall).toHaveBeenCalledWith(fakeOrder);
        });

        describe('should resolve lineItemCall', function() {
            beforeEach(function() {
                miniCartController.lineItemCall('mockOrder');
                scope.$digest();

            });
            it('should call lineItems list method', function() {
                expect(oc.LineItems.List).toHaveBeenCalled();
                scope.$digest();
                expect(miniCartController.LineItems).toBe(lineItemsList);
            });
            it('should call method list according to length of pages ', function() {
                expect(oc.LineItems.List.calls.count()).toEqual(2);
            });
            it('should call method GetProductInfo ', function() {
                expect(lineItemHelpers.GetProductInfo).toHaveBeenCalled();
            });
        });
        describe('LineItemAddedToCart',function() {
            it('should call Orders Get Method ', inject(function($rootScope) {
                spyOn(miniCartController, 'lineItemCall').and.callThrough();
                $rootScope.$broadcast('LineItemAddedToCart' ,fakeOrder);
                scope.$digest();
                expect(miniCartController.lineItemCall).toHaveBeenCalledWith(fakeOrder);
                expect(miniCartController.showLineItems).toEqual(true);
            }))
        });
        describe('OC:RemoveOrder',function() {
            it('should set Order to Null and LineItems to empty object', inject(function($rootScope) {
                $rootScope.$broadcast('OC:RemoveOrder');
                scope.$digest();
                expect(miniCartController.Order).toEqual(null);
                expect(miniCartController.LineItems).toBeTruthy();
            }))
        });
    });

});