define([
    'Ferrousbg_AdminOrder/js/pos/state',
    'Ferrousbg_AdminOrder/js/pos/customer',
    'Ferrousbg_AdminOrder/js/pos/cart',
    'Ferrousbg_AdminOrder/js/pos/shipping',
    'Ferrousbg_AdminOrder/js/pos/products',
    'Ferrousbg_AdminOrder/js/pos/store',
    'Ferrousbg_AdminOrder/js/pos/payment' // <--- 1. ИМПОРТ НА ПЛАЩАНЕ
], function (initialStateFunc, Customer, Cart, Shipping, Products, Store, Payment) {
    'use strict';

    return function (config) {

        const baseState = initialStateFunc(config);

        return {
            // Базов State
            ...baseState,

            // Модули
            ...Customer(),
            ...Cart(),
            ...Shipping(),
            ...Products(),
            ...Store(),
            ...Payment(), // <--- 2. ДОБАВЯНЕ НА ЛОГИКАТА

            // --- INIT ---
            initPOS() {
                console.log("🚀 POS Core Initializing...");

                if (this.urls && this.urls.defaultStoreId) {
                    this.currentStoreId = parseInt(this.urls.defaultStoreId);
                    console.log("🏪 Store Set to:", this.currentStoreId);
                } else {
                    console.error("❌ Error: defaultStoreId is missing in config!");
                }

                // Инициализация на под-модулите
                if (this.initShippingModule) {
                    try { this.initShippingModule(); } catch (e) { console.error("❌ Shipping Module Failed:", e); }
                }

                if (this.initPaymentModule) { // <--- 3. INIT НА ПЛАЩАНЕ
                    try { this.initPaymentModule(); } catch (e) { console.error("❌ Payment Module Failed:", e); }
                }

                // --- WATCHERS ---

                // Количка
                this.$watch('cart', () => {
                    this.calculateTotal();
                    this.updateValidity();
                });

                // Клиент (Тук е магията за смяна на адреси и плащане)
                this.$watch('customer', (customer) => {
                    this.updateValidity();
                    if (customer && customer.id) {
                        // Зареждане на адреси
                        if (typeof this.loadCustomerAddresses === 'function') {
                            this.loadCustomerAddresses(customer.id);
                        }
                        // Зареждане на любим метод за плащане
                        if (typeof this.applyCustomerDefaultPayment === 'function') { // <--- 4. ПРОВЕРКА ЗА ЛЮБИМ МЕТОД
                            this.applyCustomerDefaultPayment(customer);
                        }
                    } else {
                        this.savedAddresses = [];
                    }
                });

                // Доставка
                this.$watch('selectedShippingMethod', () => {
                    if (this.cart.length > 0 && typeof this.estimateShippingCost === 'function') {
                        this.estimateShippingCost();
                    }
                    this.updateValidity();
                });

                // Плащане (Валидация)
                this.$watch('selectedPaymentMethod', () => { // <--- 5. WATCHER ЗА ПЛАЩАНЕ
                    this.updateValidity();
                });

                // Адрес
                this.$watch('address', () => {
                    this.updateValidity();
                    if (this.cart.length > 0 && typeof this.estimateShippingCost === 'function') {
                        clearTimeout(this._addressTimeout);
                        this._addressTimeout = setTimeout(() => {
                            this.estimateShippingCost();
                        }, 1000);
                    }
                }, { deep: true });

                this.updateValidity();
                this.loading = false;
                console.log("✅ POS Ready.");
            },

            updateValidity() {
                let valid = true;

                // 1. Клиент
                if (!this.customer || (!this.customer.email && !this.isNewCustomer)) valid = false;

                // 2. Количка
                if (this.cart.length > 0) {
                    this.actionButtonLabel = 'Place Order';

                    // 3. Доставка
                    if (!this.selectedShippingMethod) valid = false;
                    if (this.selectedShippingMethod) {
                        let method = this.selectedShippingMethod.toLowerCase();
                        let isPickup = method.includes('pickup') || method.includes('store');
                        if (!isPickup && (!this.address.city || !this.address.street)) valid = false;
                    }

                    // 4. Плащане
                    if (!this.selectedPaymentMethod) valid = false; // <--- ВАЛИДАЦИЯ

                } else {
                    this.actionButtonLabel = 'Save Customer Info Only';
                }

                this.isValidOrder = valid;
            },

            handleMainAction() {
                if (this.cart.length > 0) {
                    this.placeOrder();
                } else {
                    this.saveCustomerOnly();
                }
            },

            saveCustomerOnly() {
                if (!this.isValidOrder) return;
                alert('✅ Customer info updated (Simulated).');
            },

            placeOrder() {
                if (!this.isValidOrder) return;
                
                // Validate billing address for requests
                if (this.submitMode === 'request') {
                    let billingId = this.billingAddressId;
                    
                    // If no explicit billing address, try to get default
                    if (!billingId && this.customer && this.customer.default_billing) {
                        billingId = this.customer.default_billing;
                    }
                    
                    if (!billingId) {
                        if (typeof this.notify === 'function') {
                            this.notify('No billing address found. Please select a billing address.', 'error');
                        } else {
                            alert('❌ No billing address found. Please select a billing address.');
                        }
                        return;
                    }
                }
                
                let title = this.submitMode === 'request' ? 'Submit Request?' : 'Create Order?';
                let message = this.submitMode === 'request' 
                    ? 'Are you sure you want to submit this request?' 
                    : 'Are you sure you want to finalize this order?';
                
                this.confirmModal = {
                    open: true,
                    title: title,
                    message: message
                };
                this.pendingAction = () => { this._executePlaceOrder(); };
            },

            closeConfirm(confirmed) {
                this.confirmModal.open = false;
                if (confirmed && typeof this.pendingAction === 'function') {
                    this.pendingAction();
                    this.pendingAction = null;
                }
            },

            _executePlaceOrder() {
                this.loading = true;
                this.placingOrder = true;

                const payload = {
                    store_id: this.currentStoreId,
                    customer: this.customer,
                    is_new_customer: this.isNewCustomer,
                    is_company: this.isCompany,
                    company_data: this.isCompany ? this.company : null,
                    shipping_method: this.selectedShippingMethod,
                    payment_method: this.selectedPaymentMethod,
                    address: this.address,
                    items: this.cart.map(i => ({ id: i.id, qty: i.qty })),
                    form_key: this.urls.formKey
                };

                // Add billing address for requests
                // Note: billingAddressId is already validated in placeOrder()
                if (this.submitMode === 'request') {
                    payload.billing_address_id = this.billingAddressId;
                    payload.shipping_address_id = this.address.id || null;
                }

                // Choose URL based on mode
                const url = this.submitMode === 'request' ? this.urls.createRequestUrl : this.urls.createUrl;

                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    body: JSON.stringify(payload)
                })
                    .then(r => r.json())
                    .then(d => {
                        this.loading = false;
                        this.placingOrder = false;
                        if(d.success) {
                            const message = this.submitMode === 'request' 
                                ? '✅ Request #' + d.request_id + ' submitted successfully!'
                                : '✅ Order #' + d.order_increment_id + ' Created!';
                            this._showNotification(message, 'success');
                            this.cart = [];
                            this.grandTotal = 0;
                            if(this.resetCustomer) this.resetCustomer();
                        } else {
                            this._showNotification('❌ Error: ' + d.message, 'error');
                        }
                    }).catch((e) => {
                    this.loading = false;
                    this.placingOrder = false;
                    this._showNotification('Server Error', 'error');
                });
            },

            _showNotification(message, type) {
                if (typeof this.notify === 'function') {
                    this.notify(message, type);
                } else {
                    alert(message);
                }
            }
        };
    };
});