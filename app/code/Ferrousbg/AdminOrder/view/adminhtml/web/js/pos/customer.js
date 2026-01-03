define([], function () {
    'use strict';

    return function () {
        return {
            // --- STATE (Data) ---
            customer: null,

            invoiceData: {
                wants_invoice: false,
                company: '',
                vat_id: '',
                vat_number: '',
                city: '',
                street: '',
                mol: ''
            },

            customerSearchQuery: '',
            customerResults: [],
            customerLoading: false,
            isNewCustomer: false,

            // If customerHistory is not initialized in creator.phtml, define it here for safety
            customerHistory: {
                orders: [],
                requests: [],
                loading: false,
                activeTab: 'orders'
            },

            groupMap: {
                1: 'General (B2C)',
                2: 'Wholesale (Wholesale)',
                3: 'Retailer (Retailer)',
                4: 'VIP'
            },

            // --- LOGIC ---

            searchCustomers: function() {
                if (this.customerSearchQuery.length < 2) {
                    this.customerResults = [];
                    return;
                }

                // Get Store ID from config if available
                var currentStoreId = (window.POS_CONFIG && window.POS_CONFIG.defaultStoreId)
                    ? window.POS_CONFIG.defaultStoreId
                    : 1;

                console.log("🔍 [POS] Search for: " + this.customerSearchQuery + " in Store: " + currentStoreId);
                this.customerLoading = true;

                var url = this.urls.customerSearchUrl
                    + '?q=' + encodeURIComponent(this.customerSearchQuery)
                    + '&store_id=' + currentStoreId;

                fetch(url)
                    .then(function(response) { return response.json(); })
                    .then((function(data) {
                        console.log("✅ [POS] Results found:", data);
                        this.customerResults = data;
                        this.customerLoading = false;
                    }).bind(this))
                    .catch((function(err) {
                        console.error("❌ [POS] Search error:", err);
                        this.customerLoading = false;
                    }).bind(this));
            },

            selectCustomer: function(cust) {
                console.log("👉 [POS] Selected Customer (RAW):", cust);

                // 1. Reset history on customer change
                this.customerHistory = {
                    orders: [],
                    requests: [],
                    loading: false,
                    activeTab: 'orders'
                };
                this.historyModalOpen = false;

                // 2. Save customer
                this.customer = cust;

                // Add group name (for visualization)
                if (!this.customer.group_name && this.customer.group_id) {
                    this.customer.group_name = this.groupMap[this.customer.group_id] || 'Custom Group';
                }

                // 3. Invoice Logic
                var hasCompanyData = (cust.company && cust.company.length > 0) || (cust.vat_id && cust.vat_id.length > 0);

                console.log("🏢 [POS] Company data available?", hasCompanyData);

                if (hasCompanyData) {
                    // === SEPARATING PERSONS ===
                    var accountPerson = (cust.firstname || '') + ' ' + (cust.lastname || '');
                    var billingPerson = cust.mol;

                    // Prioritize Billing name
                    var finalMol = billingPerson && billingPerson.length > 1 ? billingPerson : accountPerson;

                    this.invoiceData = {
                        wants_invoice: true,
                        company: cust.company || '',
                        vat_id: cust.vat_id || '',
                        vat_number: cust.vat_id || '',
                        city: cust.city || '',
                        street: cust.street || '',
                        mol: finalMol
                    };

                    console.log("📝 [POS] Invoice data filled with MOL:", finalMol);
                } else {
                    console.log("👤 [POS] Customer is individual (no invoice).");
                    this.invoiceData = {
                        wants_invoice: false,
                        company: '',
                        vat_id: '',
                        vat_number: '',
                        city: '',
                        street: '',
                        mol: ''
                    };
                }

                // Clear UI
                this.isNewCustomer = false;
                this.customerSearchQuery = '';
                this.customerResults = [];
            },

            resetCustomer: function() {
                console.log("🔄 [POS] Customer Reset.");
                this.customer = null;
                this.customerHistory = { orders: [], requests: [], loading: false, activeTab: 'orders' }; // Reset history too
                this.invoiceData = { wants_invoice: false, company: '', vat_id: '', city: '', street: '', mol: '' };
                this.customerSearchQuery = '';
                this.isNewCustomer = false;
            },

            openNewModal: function() {
                this.resetCustomer();
                this.isNewCustomer = true;
                this.customer = {
                    group_id: 1,
                    firstname: '',
                    lastname: '',
                    telephone: '',
                    email: ''
                };
                this.newCustomerModalOpen = true;
            },

            // === CUSTOMER HISTORY ===
            fetchCustomerHistory: function() {
                if (!this.customer || !this.customer.id) return;

                console.log("📂 [POS] Loading history for customer ID:", this.customer.id);

                // 1. Open modal and start loader
                // Using direct names from initialPosState
                this.historyModalOpen = true;
                this.isLoadingHistory = true;
                this.historyTab = 'requests'; // Open requests tab directly if you have data there

                // 2. Clear old data
                this.customerHistoryOrders = [];
                this.customerHistoryRequests = [];

                // 3. Generate URL
                var url = this.urls.customerSearchUrl.replace('search', 'historyOrders');
                url += '?customer_id=' + this.customer.id + '&form_key=' + window.FORM_KEY;

                fetch(url)
                    .then(function(res) { return res.json(); })
                    .then((function(data) {
                        this.isLoadingHistory = false;

                        if(data.success) {
                            console.log("✅ [POS] History loaded successfully!");
                            console.log("📦 ORDERS RAW DATA:", data.orders);
                            console.log("🏭 REQUESTS RAW DATA:", data.requests);

                            // KEY: Write to the correct variables
                            this.customerHistoryOrders = data.orders || [];
                            this.customerHistoryRequests = data.requests || [];

                            // Debug check after assignment
                            console.log("📊 [POS] Assigned to State -> Orders:", this.customerHistoryOrders.length);
                            console.log("📊 [POS] Assigned to State -> Requests:", this.customerHistoryRequests.length);

                        } else {
                            console.error("❌ [POS] Server Error:", data.message);
                        }
                    }).bind(this))
                    .catch((function(err) {
                        this.isLoadingHistory = false;
                        console.error("❌ [POS] AJAX Error:", err);
                    }).bind(this));
            }
        };
    };
});