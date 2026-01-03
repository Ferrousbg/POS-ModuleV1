define(['jquery'], function ($) {
    'use strict';

    return function () {
        return {
            // --- STATE ---
            isPaymentEdit: false,
            availablePaymentMethods: [],
            selectedPaymentMethod: '',

            // Default Payment Logic
            serverDefaultPayment: null, // What is currently saved in the DB
            isLoadingPayment: false,

            // Modal Logic
            showSaveModal: false,
            modalMessage: '',
            modalAction: null,
            tempSelectedMethod: null,

            // --- INIT ---
            initPaymentModule() {
                console.log("💳 Payment Module Initialized");
                this.updatePaymentMethods();

                // Initial check
                if (this.customer && this.customer.id) {
                    this.fetchDefaultPaymentFromServer(this.customer.id);
                } else {
                    this.selectDefaultPayment(null);
                }

                // WATCHER: Customer
                if (this.$watch) {
                    this.$watch('customer', (val) => {
                        this.serverDefaultPayment = null; // Reset server knowledge
                        if (val && val.id) {
                            this.fetchDefaultPaymentFromServer(val.id);
                        } else {
                            this.selectDefaultPayment(null);
                        }
                    });
                }
            },

            // --- SERVER FETCH ---
            fetchDefaultPaymentFromServer(customerId) {
                let url = this.urls.customerGetPaymentUrl;
                if (!url && this.urls.customerSavePaymentUrl) {
                    url = this.urls.customerSavePaymentUrl.replace('savePayment', 'getPayment');
                }

                if (!url || !customerId) return;

                this.isLoadingPayment = true;

                $.ajax({
                    url: url,
                    type: 'GET',
                    data: { customer_id: customerId, form_key: window.FORM_KEY },
                    dataType: 'json',
                    success: (res) => {
                        this.isLoadingPayment = false;
                        if (res.success && res.default_payment) {
                            console.log("📡 Server has default:", res.default_payment);
                            this.serverDefaultPayment = res.default_payment;
                            this.selectDefaultPayment(res.default_payment);
                        } else {
                            console.log("📡 No default on server.");
                            this.serverDefaultPayment = null;
                            this.selectDefaultPayment(null);
                        }
                    },
                    error: () => {
                        this.isLoadingPayment = false;
                        this.serverDefaultPayment = null;
                        this.selectDefaultPayment(null); // Ensure fallback runs on error
                    }
                });
            },

            // --- SELECTION LOGIC ---
            selectDefaultPayment(serverMethod) {
                // 1. Priority: Server Method
                let preferredMethod = serverMethod;

                // REMOVED: LocalStorage check
                // We no longer check 'pos_last_payment_method' here.

                if (preferredMethod) {
                    let exists = this.availablePaymentMethods.find(m => m.code === preferredMethod);
                    if (exists) {
                        this.selectedPaymentMethod = preferredMethod;
                        console.log(`💳 Auto-selected from Server: ${preferredMethod}`);
                        return;
                    }
                }

                // 2. Fallback: First available method
                if (this.availablePaymentMethods.length > 0) {
                    let currentExists = this.availablePaymentMethods.find(m => m.code === this.selectedPaymentMethod);

                    // Only switch if currently selected is invalid or empty
                    if (!this.selectedPaymentMethod || !currentExists) {
                        this.selectedPaymentMethod = this.availablePaymentMethods[0].code;
                        console.log(`💳 Fallback to first available: ${this.selectedPaymentMethod}`);
                    }
                }
            },

            updatePaymentMethods() {
                if (this.urls.allPaymentMethods && this.urls.allPaymentMethods[this.currentStoreId]) {
                    this.availablePaymentMethods = this.urls.allPaymentMethods[this.currentStoreId];
                } else {
                    this.availablePaymentMethods = [];
                }
            },

            // --- MAIN USER ACTION ---
            onUserSelectPayment(code) {
                this.tempSelectedMethod = code;
                this.selectedPaymentMethod = code;

                // REMOVED: LocalStorage set
                // localStorage.setItem('pos_last_payment_method', code);

                // If no customer, just close
                if (!this.customer || !this.customer.id) {
                    setTimeout(() => { this.isPaymentEdit = false; }, 300);
                    return;
                }

                // MODAL CHECK
                // 1. If server already knows this method, do nothing
                if (this.serverDefaultPayment === code) {
                    setTimeout(() => { this.isPaymentEdit = false; }, 300);
                    return;
                }

                // 2. Determine Question
                if (this.serverDefaultPayment) {
                    // Change existing default
                    this.modalMessage = `Client already prefers (<b>${this.getMethodTitle(this.serverDefaultPayment)}</b>).<br>Do you want to switch to the new method permanently?`;
                } else {
                    // Set new default
                    this.modalMessage = `Do you want to save <b>${this.getMethodTitle(code)}</b> as the default payment method for this client?`;
                }

                // 3. Show Modal
                this.showSaveModal = true;
            },

            // --- MODAL ACTIONS ---
            confirmSaveDefault() {
                if (this.tempSelectedMethod && this.customer && this.customer.id) {
                    this.saveDefaultPaymentToBackend(this.tempSelectedMethod);
                }
                this.closeModal();
            },

            declineSaveDefault() {
                // Just close, use method for this order only
                this.closeModal();
            },

            closeModal() {
                this.showSaveModal = false;
                this.isPaymentEdit = false;
            },

            // --- AJAX SAVE ---
            saveDefaultPaymentToBackend(code) {
                if (!this.urls.customerSavePaymentUrl) return;

                $.ajax({
                    url: this.urls.customerSavePaymentUrl,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        customer_id: this.customer.id,
                        payment_method: code,
                        form_key: this.urls.formKey
                    },
                    success: (res) => {
                        if (res.success) {
                            this.serverDefaultPayment = code; // Update local knowledge
                            if (typeof this.notify === 'function') this.notify('✅ Default method saved!');
                        } else {
                            if (typeof this.notify === 'function') this.notify(res.message, 'error');
                        }
                    }
                });
            },

            // --- UI HELPERS ---
            getSelectedMethodTitle() {
                return this.getMethodTitle(this.selectedPaymentMethod);
            },

            getMethodTitle(code) {
                if (!code) return '...';
                let m = this.availablePaymentMethods.find(x => x.code === code);
                return m ? m.title : code;
            },

            getSelectedMethodIcon() {
                if (!this.selectedPaymentMethod) return '🚫';
                let m = this.availablePaymentMethods.find(x => x.code === this.selectedPaymentMethod);
                return m ? (m.icon || '💳') : '💳';
            }
        };
    };
});