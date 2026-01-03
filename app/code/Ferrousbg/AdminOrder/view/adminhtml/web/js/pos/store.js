define([], function () {
    'use strict';

    return function () {
        return {
            // State
            pendingStoreId: null,

            getStoreName(id) {
                // ВАЖНО: Проверка дали urls съществува, преди да го ползваме
                if (!this.urls || !this.urls.stores) {
                    return 'Zarejdane...';
                }

                let store = this.urls.stores.find(s => s.id == id);
                return store ? (store.website + ' - ' + store.name) : 'Select Store';
            },

            requestStoreSwitch(newStoreId) {
                // Защита и тук
                if (!this.urls) return;

                // Ако количката е празна и няма клиент, сменяме веднага
                if (this.cart.length === 0 && !this.customer.id && !this.isNewCustomer) {
                    this.currentStoreId = newStoreId;
                    this.switchStoreInternal();
                    return;
                }

                // Иначе искаме потвърждение
                this.pendingStoreId = newStoreId;
                this.confirmModal.title = 'Смяна на магазин?';
                this.confirmModal.message = 'Внимание: Текущата количка и клиент ще бъдат изчистени.';
                this.confirmModal.open = true;
            },

            closeConfirm(confirmed) {
                this.confirmModal.open = false;
                if (confirmed && this.pendingStoreId) {
                    this.currentStoreId = this.pendingStoreId;
                    this.switchStoreInternal();
                }
                this.pendingStoreId = null;
            },

            switchStoreInternal() {
                this.loading = true;

                // Нулиране на всичко
                this.cart = [];
                this.grandTotal = 0;

                // Викаме методи от другите миксини (customer.js / shipping.js)
                if (this.resetCustomer) this.resetCustomer();

                setTimeout(() => {
                    if (this.updateShippingMethods) this.updateShippingMethods();
                    this.loading = false;
                }, 200);
            }
        };
    };
});