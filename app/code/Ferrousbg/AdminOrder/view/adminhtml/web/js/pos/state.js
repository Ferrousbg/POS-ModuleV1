define([], function () {
    'use strict';

    return function (configData) {
        return {
            // --- Core ---
            urls: configData, // Тук ще дойде конфигурацията от PHP
            currentStoreId: null,
            loading: true,
            placingOrder: false,
            isValidOrder: false,
            actionButtonLabel: 'Place Order',

            // --- Products & Cart ---
            searchQuery: '',
            searchResults: [],
            productSearchOpen: false,
            cart: [],
            grandTotal: 0,
            productModalOpen: false,
            selectedProduct: null,
            totals: { subtotal: 0, tax: 0, discount: 0, grand_total: 0 },

            // --- Customer ---
            customer: {},
            isNewCustomer: false,
            isEditMode: false,
            isCompany: false,
            company: { name: '', uic: '', vat: '' },
            customerSearchQuery: '',
            customerResults: [],
            customerModalOpen: false,

            // --- Shipping ---
            selectedShippingMethod: '',
            availableShippingMethods: [],
            address: {
                street: '',
                street_number: '',
                note: '',
                city: '',
                postcode: '',
                telephone: '',
                cityId: null
            },
            savedAddresses: [],
            saveAsDefault: false,

            backupAddress: null,
            isShippingEdit: false,
            openDropdown: false,
            preventModal: false,
            shippingPrice: 0,

            // --- Modals ---
            officeModal: {
                open: false,
                loading: false,
                mode: 'office',
                step: 'city',
                searchQuery: '',

                // Данни
                items: [],
                allOffices: [],
                rawOffices: [],
                currentCityOffices: [],

                selectedCity: '',
                selectedCityId: null
            },

            confirmModal: { open: false, title: '', message: '' },

            // --- Placeholder Functions (Празни функции, за да не гърми Alpine) ---
            getStoreName: function() { return 'Loading...'; },
            requestStoreSwitch: function() {},
            closeConfirm: function() {},
            searchProducts: function() {},
            addToCart: function() {},
            removeFromCart: function() {},
            searchCustomers: function() {},
            selectCustomer: function() {},
            toggleNewCustomer: function() {},
            startNewCustomer: function() {},
            saveCustomerOnly: function() {},

            // Econt Functions
            openEcontManual: function() {},
            openAddressWizard: function() {},
            openStreetSelector: function() {},
            selectMethodManual: function() {},
            closeOfficeModal: function() {},
            selectItem: function() {},
            backToCities: function() {},
            onSearchInput: function() {
                console.log('Search input triggered (placeholder)');
            },

            // Address Book Placeholders
            loadCustomerAddresses: function() {},
            saveCurrentAddressToBook: function() {},
            saveCurrentOfficeToBook: function() {},
            applySavedAddress: function() {},
            saveAddress: function() {},

            isLocalOffice: function() { return false; },
            isLocalAddress: function() { return false; },
            getMethodTitle: function() { return ''; },

            placeOrder: function() {},
            handleMainAction: function() {},
            formatPrice: function(p) { return p; }
        };
    };
});